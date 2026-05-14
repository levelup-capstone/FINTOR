import os
import jwt
import requests
import time
import re
import json
import threading
import yfinance as yf
import finnhub
from requests import Session as ReqSession
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from bs4 import BeautifulSoup
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

import models, schemas, crud
from database import engine, get_db
from seed import seed as run_seed
from game_seed import seed as run_game_seed
from scoring import calculate_score

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fintor Auth Server")

# DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"
DEV_MODE = False
KST = timezone(timedelta(hours=9))

# --- [CORS 설정] ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- [환경 변수 로드] ---
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET")
KAKAO_REDIRECT_URI = os.getenv("KAKAO_REDIRECT_URI")
KIS_BASE_URL = os.getenv("KIS_BASE_URL")
KIS_APP_KEY = os.getenv("KIS_APP_KEY")
KIS_APP_SECRET = os.getenv("KIS_APP_SECRET")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="토큰 검증에 실패했습니다.")
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


# Finnhub 클라이언트 초기화
finnhub_client = finnhub.Client(api_key=FINNHUB_API_KEY)

# yfinance 브라우저 세션 (Rate Limit 우회)
yf_session = ReqSession()
yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
})


# =====================================================================
# [Auth] 카카오 로그인 / 로그아웃
# =====================================================================
def create_jwt_token(user_id: int, expires_delta: timedelta):
    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")


@app.post("/api/auth/kakao/login", response_model=schemas.LoginResponse)
def kakao_login(req: schemas.KakaoLoginRequest, db: Session = Depends(get_db)):
    token_url = "https://kauth.kakao.com/oauth/token"
    token_payload = {
        "grant_type": "authorization_code",
        "client_id": KAKAO_REST_API_KEY,
        "redirect_uri": KAKAO_REDIRECT_URI,
        "code": req.code,
        "client_secret": KAKAO_CLIENT_SECRET
    }

    token_res = requests.post(token_url, data=token_payload)
    if token_res.status_code != 200:
        error_detail = token_res.json()
        print(f"🚨 Kakao Token Error: {error_detail}")
        return JSONResponse(status_code=400, content={
            "success": False,
            "message": f"카카오 에러: {error_detail.get('error_description', 'Auth Failed')}",
            "data": None
        })

    kakao_access_token = token_res.json().get("access_token")
    user_info_url = "https://kapi.kakao.com/v2/user/me"
    headers = {"Authorization": f"Bearer {kakao_access_token}"}
    user_res = requests.get(user_info_url, headers=headers)

    if user_res.status_code != 200:
        return JSONResponse(status_code=401, content={
            "success": False, "message": "카카오 유저 정보 조회 실패", "data": None
        })

    user_data = user_res.json()
    kakao_id = str(user_data.get("id"))
    properties = user_data.get("properties", {})
    nickname = properties.get("nickname", "Unknown")
    profile_image = properties.get("profile_image", "")

    db_user = crud.get_user_by_kakao_id(db, kakao_id=kakao_id)
    is_new_user = False
    if not db_user:
        is_new_user = True
        db_user = crud.create_user(db, kakao_id, nickname, profile_image)

    service_access_token = create_jwt_token(db_user.id, timedelta(hours=2))
    service_refresh_token = create_jwt_token(db_user.id, timedelta(days=14))
    redirect_url = "/survey" if is_new_user else "/dashboard"
    msg = "회원가입 성공 (신규)" if is_new_user else "로그인 성공 (기존)"

    return {
        "success": True,
        "message": msg,
        "data": {
            "accessToken": service_access_token,
            "refreshToken": service_refresh_token,
            "userId": db_user.id,
            "nickname": db_user.nickname,
            "profileImage": db_user.profile_image,
            "isNewUser": is_new_user,
            "redirectUrl": redirect_url
        }
    }


@app.post("/api/auth/logout")
def logout():
    return {"success": True, "message": "로그아웃 처리가 완료되었습니다."}


# =====================================================================
# [1] 한국투자증권 - 국내 지수
# =====================================================================
KIS_DOMESTIC_SYMBOLS = {
    "KOSPI":     "0001",
    "KOSDAQ":    "1001",
    "VKOSPI":    "0503",
    "KRX200IT":  "1028",
    "KRXHEALTH": "1035",
    "BBIG":      "4411",
}

_kis_token_cache = {"token": None, "expires_at": 0}

def get_kis_access_token():
    # 캐시된 토큰이 유효하면 재사용 (한투증 토큰 유효기간 ~24시간)
    if _kis_token_cache["token"] and time.time() < _kis_token_cache["expires_at"]:
        return _kis_token_cache["token"]

    url = f"{KIS_BASE_URL}/oauth2/tokenP"
    payload = {
        "grant_type": "client_credentials",
        "appkey": KIS_APP_KEY,
        "appsecret": KIS_APP_SECRET
    }
    try:
        res = requests.post(url, json=payload, timeout=5)
        if res.status_code != 200:
            print(f"❌ KIS 인증 실패: {res.text}")
            return None
        token = res.json().get("access_token")
        _kis_token_cache["token"] = token
        _kis_token_cache["expires_at"] = time.time() + 23 * 3600  # 23시간 후 갱신
        print("🔑 KIS 접근토큰 신규 발급 완료")
        return token
    except Exception as e:
        print(f"🚨 KIS 네트워크 오류: {str(e)}")
        return None


def fetch_kis_domestic(symb: str, token: str):
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "appkey": KIS_APP_KEY,
        "appsecret": KIS_APP_SECRET,
        "custtype": "P",
        "tr_id": "FHPUP02100000"
    }
    url = f"{KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price"
    params = {"FID_COND_MRKT_DIV_CODE": "U", "FID_INPUT_ISCD": symb}
    try:
        res = requests.get(url, headers=headers, params=params, timeout=5)
        output = res.json().get("output", {})
        return {
            "price":        float(output.get("bstp_nmix_prpr", 0) or 0),
            "change_rate":  float(output.get("bstp_nmix_prdy_ctrt", 0) or 0),
            "change_value": float(output.get("bstp_nmix_prdy_vrss", 0) or 0),
            "source":       "kis"
        }
    except Exception as e:
        print(f"🚨 KIS [{symb}] 오류: {str(e)}")
        return None


# =====================================================================
# [2] Finnhub - 미국 지수 (장중 실시간 우선)
# =====================================================================
FINNHUB_SYMBOLS = {
    "SP500":     "^GSPC",
    "NASDAQ100": "^NDX",
    "DOW30":     "^DJI",
    "SOX":       "^SOX",
    "NBI":       "^NBI",
    "FANGPLUS":  "^NYFANG",
    "VIX":       "^VIX",
    "US10Y":     "^TNX",
}

def fetch_finnhub_quote(name: str, symbol: str) -> dict | None:
    try:
        data = finnhub_client.quote(symbol)
        current = float(data.get("c", 0) or 0)
        change  = float(data.get("d", 0) or 0)
        rate    = float(data.get("dp", 0) or 0)

        if current == 0:
            print(f"⚠️ Finnhub [{name}] 데이터 없음 → yfinance fallback")
            return None

        return {
            "price":        round(current, 4),
            "change_rate":  round(rate, 2),
            "change_value": round(change, 4),
            "source":       "finnhub"
        }
    except Exception as e:
        print(f"🚨 Finnhub [{name}] 오류: {str(e)} → yfinance fallback")
        return None


# =====================================================================
# [3] yfinance - 환율 / 원자재 / 해외지수 / 암호화폐
# =====================================================================
YFINANCE_SYMBOLS = {
    "SP500":       "^GSPC",
    "NASDAQ100":   "^NDX",
    "DOW30":       "^DJI",
    "SOX":         "^SOX",
    "NBI":         "^NBI",
    "FANGPLUS":    "^NYFANG",
    "VIX":         "^VIX",
    "US10Y":       "^TNX",
    "NIKKEI225":   "^N225",
    "HANSENG":     "^HSI",
    "SSE":         "000001.SS",
    "EUROSTOXX50": "^STOXX50E",
    "USD_KRW":     "USDKRW=X",
    "JPY_KRW":     "JPYKRW=X",
    "EUR_KRW":     "EURKRW=X",
    "DXY":         "DX-Y.NYB",
    "USD_JPY":     "USDJPY=X",
    "EUR_USD":     "EURUSD=X",
    "WTI":         "CL=F",
    "GOLD":        "GC=F",
    "SILVER":      "SI=F",
    "COPPER":      "HG=F",
    "NATGAS":      "NG=F",
    "BTC_KRW":     "BTC-KRW",
}

def fetch_all_yfinance(symbols_map: dict) -> dict:
    """yf.download()로 전체 심볼을 한 번에 배치 요청 (Rate Limit 최소화)"""
    results = {}
    try:
        symbol_list = list(symbols_map.values())
        name_by_symbol = {v: k for k, v in symbols_map.items()}

        df = yf.download(
            tickers=symbol_list,
            period="5d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            session=yf_session,
        )

        if df.empty:
            print("⚠️ yfinance 배치 다운로드 결과 없음")
            return results

        for symbol in symbol_list:
            name = name_by_symbol.get(symbol)
            if not name:
                continue
            try:
                # 단일 심볼이면 df 자체가 OHLCV, 복수면 df[symbol]
                hist = df[symbol] if len(symbol_list) > 1 else df
                hist = hist.dropna(subset=["Close"])
                if len(hist) < 1:
                    print(f"⚠️ yfinance [{name}] 데이터 없음")
                    continue
                current = float(hist["Close"].iloc[-1])
                prev    = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
                change_value = round(current - prev, 4)
                change_rate  = round((change_value / prev * 100) if prev != 0 else 0, 2)
                results[name] = {
                    "price":        round(current, 4),
                    "change_value": change_value,
                    "change_rate":  change_rate,
                    "source":       "yfinance"
                }
            except Exception as e:
                print(f"🚨 yfinance [{name}] 파싱 오류: {str(e)}")
    except Exception as e:
        print(f"🚨 yfinance 배치 오류: {str(e)}")
    return results


# =====================================================================
# [핵심] 외부 API 호출 후 DB에 저장하는 함수
# 백그라운드 스케줄러 + 서버 시작 시 최초 1회 실행
# =====================================================================
def collect_and_save_market_data():
    print(f"🔄 시장 데이터 수집 시작 ({datetime.now(KST).strftime('%H:%M:%S')} KST)")

    # DB 세션 직접 생성 (스케줄러는 Depends 못 씀)
    db: Session = next(get_db())

    try:
        now = datetime.now(KST)
        all_results = {}

        # 1. 한투증: 국내 지수
        token = get_kis_access_token()
        if token:
            for name, symb in KIS_DOMESTIC_SYMBOLS.items():
                data = fetch_kis_domestic(symb, token)
                if data:
                    all_results[name] = data
                time.sleep(0.05)
        else:
            print("⚠️ KIS 토큰 발급 실패 - 국내 지수 스킵")

        # 2. Finnhub: 미국 지수 장중 우선
        for name, symbol in FINNHUB_SYMBOLS.items():
            data = fetch_finnhub_quote(name, symbol)
            if data:
                all_results[name] = data
            time.sleep(0.05)

        # 3. yfinance: 나머지 + Finnhub fallback (배치 요청)
        yf_needed = {k: v for k, v in YFINANCE_SYMBOLS.items()
                     if not (k in all_results and all_results[k].get("source") == "finnhub")}
        yf_results = fetch_all_yfinance(yf_needed)
        all_results.update(yf_results)

        # DB 저장 (upsert 방식 - 있으면 업데이트, 없으면 삽입)
        for name, data in all_results.items():
            crud.upsert_market_index(db, name=name, data=data, updated_at=now)

        print(f"✅ 시장 데이터 저장 완료 ({len(all_results)}개)")

    except Exception as e:
        print(f"🚨 시장 데이터 수집 오류: {str(e)}")
    finally:
        db.close()


# =====================================================================
# [뉴스 파이프라인] 네이버 수집, 중복 필터링, 전처리, LLM 분석
# =====================================================================
def clean_html(raw_html: str) -> str:
    """정규표현식을 활용한 데이터 전처리 (Sanitization)"""
    clean_text = re.sub(r'<.*?>', '', raw_html)
    clean_text = re.sub(r'&quot;|&amp;|&lt;|&gt;|&apos;', ' ', clean_text)
    return clean_text.strip()

def scrape_naver_news_body(url: str) -> str:
    """네이버 뉴스 링크에 접속하여 본문 텍스트만 추출합니다."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, "lxml")
            body_area = soup.select_one("#dic_area")
            if body_area:
                return body_area.get_text(separator=" ", strip=True)
        return ""
    except Exception as e:
        print(f"⚠️ 본문 스크래핑 에러 [{url}]: {e}", flush=True)
        return ""

def analyze_news_with_gemini(title: str, full_text: str) -> dict:
    if not GEMINI_API_KEY:
        return {"category": "오류", "sentiment": "중립", "reason": "API 키 누락"}

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-3.1-flash-lite-preview')

    truncated_text = full_text[:3000]

    prompt = f"""
    당신은 전문 금융 애널리스트입니다.
    다음 뉴스 기사의 제목과 [본문]을 심층 분석하여, 반드시 아래의 JSON 형식으로만 응답해 주세요.

    [뉴스 기사]
    제목: {title}
    본문: {truncated_text}

    [출력 형식 (JSON)]
    {{
        "category": "주식, ETF, 예적금, 채권, 암호화폐, 원화, 금, 기타 중 반드시 택1",
        "sentiment": "호재, 악재, 중립 중 반드시 택1",
        "tag": "반도체, 디스플레이, IT, 게임, AI, 로봇, 통신/네트워크, 자동차, 
        배터리, 조선, 우주항공, 방산, 바이오, 헬스케어, 금융, 증권, 가상자산/핀테크, 
        철강/금속, 화학/정유, 건설/건자재, 유통/소비재, 화장품/의류, 음식료, 엔터테인먼트/미디어, 여행/항공, 에너지/환경, 
        전력/유틸리티, 기타 중 기사 본문의 핵심 주제와 가장 밀접한 것 반드시 택1",
        "reason": "이 기사가 왜 해당 감성(호재/악재/중립)인지 본문 내용을 바탕으로 50자 이내로 명확하게 존댓말로 작성"
    }}
    """

    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"🚨 Gemini 분석 에러: {e}", flush=True)
        return {"category": "오류", "sentiment": "중립", "reason": "분석 실패"}

TFIDF_SIMILARITY_THRESHOLD = 0.35

def _build_tfidf(titles: list[str]):
    """제목 리스트로 TF-IDF 벡터라이저를 학습하고 (vectorizer, matrix) 반환"""
    if not titles:
        return None, None
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 3))
    return vec, vec.fit_transform(titles)

def run_news_pipeline():
    """뉴스 데이터 수집, 필터링, 전처리, LLM 분석, DB 적재"""
    print(f"📰 뉴스 파이프라인 가동 ({datetime.now(KST).strftime('%H:%M:%S')} KST)", flush=True)
    db: Session = next(get_db())

    try:
        # 3일이 경과한 과거 기사 DB에서 삭제
        deleted_news_count = crud.delete_old_news(db, days_to_keep=3)
        if deleted_news_count > 0:
            print(f"🧹 보관 기간(3일)이 경과한 뉴스 {deleted_news_count}개를 삭제했습니다.", flush=True)
        else:
            print("🧹 삭제할 오래된 뉴스 기사가 없습니다. 현재 DB가 깔끔한 상태입니다.", flush=True)

        # 기존 (id, title) 목록을 파이프라인 시작 시 한 번만 로드
        existing_news: list[tuple[int, str]] = crud.get_all_news_titles(db)
        existing_titles: list[str] = [title for _, title in existing_news]

        # 기존 제목 전체로 TF-IDF 벡터라이저 학습 (문자 2~3-gram)
        vectorizer, tfidf_matrix = _build_tfidf(existing_titles)
        print(f"📋 기존 뉴스 {len(existing_titles)}개 TF-IDF 벡터화 완료 (중복 검사 기준)", flush=True)

        url = "https://openapi.naver.com/v1/search/news.json"
        headers = {"X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET}

        now_utc = datetime.now(timezone.utc)
        start_of_today = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)

        target_keywords = [
            "주식", "증시", "금리", "환율", "코인",
            "채권", "원자재", "금", "은", "원화, 속보"
        ]

        total_saved = 0
        total_link_skip = 0
        total_title_skip = 0

        for keyword in target_keywords:
            link_skip_count = 0
            title_skip_count = 0
            params = {"query": keyword, "display": 15, "sort": "date"}
            res = requests.get(url, headers=headers, params=params)

            if res.status_code != 200:
                print(f"🚨 네이버 API 호출 실패 [{keyword}]", flush=True)
                continue

            for item in res.json().get("items", []):
                link = item.get("link")
                pub_date_str = item.get("pubDate", "")

                try:
                    pub_date = datetime.strptime(pub_date_str, "%a, %d %b %Y %H:%M:%S %z")
                    if pub_date < start_of_today:
                        continue
                except ValueError:
                    continue

                if "n.news.naver.com" not in link:
                    continue
                if "sid=101" not in link:
                    continue

                # 1차: 링크 기반 중복 검사
                if crud.get_news_by_link(db, link):
                    link_skip_count += 1
                    continue

                title = clean_html(item.get("title", ""))

                # 2차: TF-IDF 코사인 유사도 기반 중복 검사
                if vectorizer is not None:
                    new_vec = vectorizer.transform([title])
                    scores = cosine_similarity(new_vec, tfidf_matrix)[0]
                    max_idx = int(scores.argmax())
                    max_score = float(scores[max_idx])
                    if max_score >= TFIDF_SIMILARITY_THRESHOLD:
                        matched_id, matched_title = existing_news[max_idx]
                        title_skip_count += 1
                        print(
                            f"🔁 유사 기사 중복 감지 (TF-IDF 유사도 {max_score:.3f})\n"
                            f"   신규: [{title}]\n"
                            f"   기존: [DB ID:{matched_id}] [{matched_title}]",
                            flush=True,
                        )
                        continue

                description = clean_html(item.get("description", ""))

                full_text = scrape_naver_news_body(link)
                if not full_text:
                    full_text = description

                print(f"🤖 뉴스 본문 분석 중 [{title}]", flush=True)
                start_time = time.time()
                ai_result = analyze_news_with_gemini(title, full_text)
                execution_time = time.time() - start_time
                print(f"⏱️ 분석 완료. 소요 시간: {execution_time:.2f}초", flush=True)

                news_data = {
                    "title": title,
                    "link": link,
                    "description": description,
                    "category": ai_result.get("category", "오류"),
                    "sentiment": ai_result.get("sentiment", "중립"),
                    "tag": ai_result.get("tag", "기타"),
                    "reason": ai_result.get("reason", "분석 실패"),
                    "pub_date": pub_date_str,
                    "created_at": now_utc
                }

                saved_news = crud.create_news(db, news_data)
                # 저장 직후 리스트 및 벡터라이저 갱신 → 같은 실행 내 이후 키워드에서도 중복 차단
                existing_news.append((saved_news.id, title))
                existing_titles.append(title)
                vectorizer, tfidf_matrix = _build_tfidf(existing_titles)
                total_saved += 1
                print(f"✅ 뉴스 적재 완료 [{keyword}] - {ai_result.get('sentiment')}: {ai_result.get('reason')}", flush=True)

                # Gemini 무료 API RPM 초과 방지
                time.sleep(2.1)

            total_skip = link_skip_count + title_skip_count
            if total_skip > 0:
                print(
                    f"📊 [{keyword}] 총 {total_skip}개 제외 "
                    f"(링크 중복: {link_skip_count}개 / 제목 유사도 중복: {title_skip_count}개)",
                    flush=True,
                )
            total_link_skip += link_skip_count
            total_title_skip += title_skip_count

        print(
            f"🏁 뉴스 수집 사이클 완료 ({datetime.now(KST).strftime('%H:%M:%S')} KST) | "
            f"신규 적재: {total_saved}개 / 링크 중복 제외: {total_link_skip}개 / 제목 유사도 중복 제외: {total_title_skip}개",
            flush=True,
        )

    except Exception as e:
        print(f"🚨 뉴스 파이프라인 에러: {e}", flush=True)
    finally:
        db.close()


# =====================================================================
# [백그라운드 스케줄러]
# =====================================================================

scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup_event():
    if DEV_MODE:
        print("💻 개발 모드입니다.")
    else:
        print("🏢 운영 모드입니다.")

    # 포트폴리오 템플릿 시드 데이터 주입
    run_seed()
    # 게임 시나리오 시드 데이터 주입
    run_game_seed()
    # 서버 시작 시 최초 1회 실행 (블로킹 방지를 위해 백그라운드 스레드로)
    threading.Thread(target=collect_and_save_market_data, daemon=True).start()
    threading.Thread(target=run_news_pipeline, daemon=True).start()

    # 지수: DEV_MODE면 1분, 아니면 5분 / 뉴스: DEV_MODE면 10분, 아니면 30분
    index_interval = 1 if DEV_MODE else 5
    news_interval  = 10 if DEV_MODE else 30
    scheduler.add_job(collect_and_save_market_data, "interval", minutes=index_interval)
    scheduler.add_job(run_news_pipeline, "interval", minutes=news_interval)
    scheduler.add_job(_game_daily_settlement, "cron", hour=0, minute=0, timezone=KST)
    scheduler.start()
    print(f"⏰ 스케줄러 시작 (지수 {index_interval}분 / 뉴스 {news_interval}분 / 게임 정산 매일 자정 KST)")
    
@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()
    print("⏰ 스케줄러 종료")


# =====================================================================
# [메인 엔드포인트] DB에서 바로 꺼내서 반환
# =====================================================================
@app.get("/api/v1/market/indices")
def get_market_indices(db: Session = Depends(get_db)):
    rows = crud.get_all_market_indices(db)

    if not rows:
        raise HTTPException(status_code=503, detail="시장 데이터 준비 중입니다. 잠시 후 다시 시도해주세요.")

    data = {}
    latest_updated_at = None

    for row in rows:
        data[row.name] = {
            "price":        row.price,
            "change_rate":  row.change_rate,
            "change_value": row.change_value,
            "source":       row.source,
        }
        # 가장 최근 updated_at 추적
        if latest_updated_at is None or row.updated_at > latest_updated_at:
            latest_updated_at = row.updated_at

    return {
        "success": True,
        "message": "시장 지표 데이터 조회 완료",
        "data": data,
        "updated_at": latest_updated_at.isoformat() if latest_updated_at else None
    }


# 수집된 뉴스를 프론트엔드로 전달하는 API 엔드포인트
@app.get("/api/v1/market/news")
def get_market_news(db: Session = Depends(get_db)):
    news_list = crud.get_latest_news(db)
    view_map = crud.get_view_counts_24h_map(db, [n.id for n in news_list])
    return {
        "success": True,
        "data": [
            {
                "id":          n.id,
                "title":       n.title,
                "description": n.description,
                "category":    n.category,
                "sentiment":   n.sentiment,
                "reason":      n.reason,
                "tag":         n.tag,
                "link":        n.link,
                "pub_date":    n.pub_date,
                "created_at":  n.created_at.isoformat() if n.created_at else None,
                "view_count":  view_map.get(n.id, 0),
            }
            for n in news_list
        ]
    }


# 24시간 기준 인기 뉴스 (조회수 상위 5개)
@app.get("/api/v1/market/news/popular")
def get_popular_news(db: Session = Depends(get_db)):
    rows = crud.get_popular_news_24h(db, limit=5)
    return {
        "success": True,
        "data": [
            {
                "id":          n.id,
                "title":       n.title,
                "description": n.description,
                "category":    n.category,
                "sentiment":   n.sentiment,
                "reason":      n.reason,
                "link":        n.link,
                "pub_date":    n.pub_date,
                "view_count":  cnt,
            }
            for n, cnt in rows
        ]
    }


# 뉴스 클릭 시 조회수 기록
@app.post("/api/v1/market/news/{news_id}/view")
def add_news_view(news_id: int, db: Session = Depends(get_db)):
    crud.log_news_view(db, news_id)
    return {"success": True}


# =====================================================================
# [포트폴리오 추천] Risk Score 계산 로직
# =====================================================================

RISK_TYPE_SCORE = {"v-low": 1, "low": 4, "high": 8, "v-high": 12}
EXPERIENCE_SCORE = {"none": 0, "under-6m": 1, "6m-1y": 2, "1y-3y": 3, "3y-5y": 4, "over-5y": 5}
PERIOD_SCORE = {"long": 1, "m-long": 2, "s-mid": 3, "short": 4}
GOAL_SCORE = {
    "saving": 1, "retirement": 1, "home-ownership": 1,
    "investment-management": 2, "others": 2,
    "growth": 3,
}
AGE_SCORE = {"under-20": 2, "20y": 2, "30y": 1, "40y": 1, "50y": 0, "over-60": 0}
# 자산 규모가 클수록 안정 지향 → 점수 차감
ASSETS_SCORE = {
    "under-500": 2, "500-1000": 1,
    "1000-5000": 0, "5000-1m": 0,
    "1m-3m": -1, "over-3m": -2, "over_3m": -2,
}
INCOME_SCORE = {
    "under-200": 0, "200-400": 0,
    "400-600": 1, "600-800": 1,
    "800-1000": 2, "over-1000": 2,
}
RISK_LABELS = {1: "안정형", 2: "안정추구형", 3: "위험중립형", 4: "적극투자형", 5: "공격투자형"}


def calc_risk_score(survey: schemas.SurveyCreate) -> int:
    return (
        RISK_TYPE_SCORE.get(survey.risk_type, 1)
        + EXPERIENCE_SCORE.get(survey.investment_experience, 0)
        + PERIOD_SCORE.get(survey.preferred_period, 1)
        + GOAL_SCORE.get(survey.investment_goal, 1)
        + AGE_SCORE.get(survey.age_group, 1)
        + ASSETS_SCORE.get(survey.investment_assets, 0)
        + INCOME_SCORE.get(survey.monthly_income, 0)
    )


def score_to_level(score: int) -> int:
    if score <= 6:    return 1
    elif score <= 12: return 2
    elif score <= 18: return 3
    elif score <= 24: return 4
    else:             return 5


def recommend_templates(db: Session, risk_level: int, preferred_assets: list) -> list:
    templates = crud.get_templates_by_risk_level(db, risk_level)
    user_set = set(preferred_assets)
    return sorted(templates, key=lambda t: (-len(user_set & set(t.tags)), t.id))[:3]


# =====================================================================
# [설문조사] 저장 및 포트폴리오 추천 반환
# =====================================================================

@app.post("/api/survey", response_model=schemas.SurveyResponse)
def submit_survey(
    survey_data: schemas.SurveyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        existing_survey = db.query(models.Survey).filter(models.Survey.user_id == current_user.id).first()
        if existing_survey:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "이미 설문을 완료한 사용자입니다.",
                "data": None
            })

        new_survey = models.Survey(user_id=current_user.id, **survey_data.model_dump())
        db.add(new_survey)
        db.commit()

        score      = calc_risk_score(survey_data)
        risk_level = score_to_level(score)
        risk_label = RISK_LABELS[risk_level]

        return {
            "success": True,
            "message": "설문이 완료되었습니다.",
            "data": {
                "risk_level": risk_level,
                "risk_label": risk_label,
            },
        }

    except Exception as e:
        db.rollback()
        print(f"🚨 [Survey 저장 오류]: {e}")
        return JSONResponse(status_code=500, content={
            "success": False,
            "message": "서버 내부 오류로 인해 데이터를 저장하지 못했습니다."
        })


# =====================================================================
# [포트폴리오] 조회 / 생성
# =====================================================================

@app.get("/api/v1/portfolios")
def get_portfolio(userid: int, db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id=userid)
    if not user:
        return JSONResponse(status_code=404, content={
            "success": False,
            "error": {"code": "USER_NOT_FOUND", "message": "해당 사용자를 찾을 수 없습니다."}
        })

    portfolio = crud.get_portfolio_by_user_id(db, user_id=userid)
    if not portfolio:
        return JSONResponse(status_code=404, content={
            "success": False,
            "error": {"code": "DATA_NOT_FOUND", "message": "포트폴리오 정보가 존재하지 않습니다."}
        })

    tmpl  = portfolio.template
    today = datetime.now(KST).date()
    start = portfolio.created_at.date() if portfolio.created_at else today
    d_day = (today - start).days

    return {
        "success": True,
        "data": {
            "portfolio": {
                "template_id": tmpl.id          if tmpl else None,
                "risk_level":  tmpl.risk_level  if tmpl else None,
                "risk_label":  RISK_LABELS.get(tmpl.risk_level) if tmpl else None,
                "title":       tmpl.title       if tmpl else portfolio.name,
                "allocations": [
                    {"asset": a.asset, "ratio": a.ratio}
                    for a in portfolio.allocations
                ],
                "d_day": d_day,
            }
        }
    }


@app.post("/api/v1/portfolios", status_code=201)
def create_portfolio(req: schemas.PortfolioCreate, db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id=req.userid)
    if not user:
        return JSONResponse(status_code=404, content={
            "success": False,
            "error": {"code": "USER_NOT_FOUND", "message": "해당 사용자를 찾을 수 없습니다."}
        })

    template = crud.get_template_by_id(db, template_id=req.template_id)
    if not template:
        return JSONResponse(status_code=404, content={
            "success": False,
            "error": {"code": "TEMPLATE_NOT_FOUND", "message": "포트폴리오 템플릿을 찾을 수 없습니다."}
        })

    try:
        portfolio = crud.create_portfolio(
            db          = db,
            user_id     = req.userid,
            template_id = template.id,
            profile_id  = template.profile_id,
            name        = RISK_LABELS.get(template.risk_level, template.title),
            allocations = template.allocations,
        )
    except Exception as e:
        print(f"🚨 포트폴리오 생성 오류: {str(e)}")
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": {"code": "SERVER_ERROR", "message": "서버 내부 오류가 발생했습니다."}
        })

    return {
        "success": True,
        "data": {
            "portfolio": {
                "template_id": template.id,
                "risk_level":  template.risk_level,
                "risk_label":  RISK_LABELS.get(template.risk_level),
                "title":       template.title,
                "allocations": [
                    {"asset": a.asset, "ratio": a.ratio}
                    for a in portfolio.allocations
                ],
            }
        }
    }



# =====================================================================
# [레벨] 사용자 레벨 / 경험치 조회
# =====================================================================

@app.get("/api/v1/users/{user_id}/level")
def get_user_level(user_id: int, db: Session = Depends(get_db)):
    # 유저 존재 여부 확인
    user = crud.get_user_by_id(db, user_id=user_id)
    if not user:
        return JSONResponse(status_code=404, content={
            "success": False,
            "error": {"code": "USER_NOT_FOUND", "message": "해당 사용자를 찾을 수 없습니다."}
        })

    user_level = crud.get_user_level(db, user_id=user_id)

    # 레벨 데이터가 없으면 자동 생성 (level=1, exp=0)
    if not user_level:
        user_level = crud.create_user_level(db, user_id=user_id)

    return {
        "success": True,
        "data": {
            "userId":    user_id,
            "level":     user_level.level,
            "exp":       user_level.exp,
            "updatedAt": user_level.updated_at.isoformat() if user_level.updated_at else None
        }
    }


# =====================================================================
# [게임 시뮬레이터] 시나리오 목록
# =====================================================================

@app.get("/api/game/scenarios")
def get_scenarios(db: Session = Depends(get_db)):
    scenarios = crud.get_all_scenarios(db)
    return {
        "success": True,
        "data": [
            {
                "id":           s.id,
                "stage":        s.season,
                "name":         s.name,
                "theme":        s.theme,
                "scenario_key": s.scenario_key,
                "assets":       s.assets,
            }
            for s in scenarios
        ]
    }


# =====================================================================
# [게임 시뮬레이터] 시뮬레이션 시작
# =====================================================================

@app.post("/api/game/start")
def start_game(
    req: schemas.GameStartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scenario = crud.get_scenario_by_id(db, req.scenario_id)
    if not scenario:
        return JSONResponse(status_code=404, content={"success": False, "message": "시나리오를 찾을 수 없습니다."})

    # 이미 진행 중인 participation이 있으면 반환
    existing = crud.get_active_participation(db, current_user.id)
    if existing and existing.scenario_id == req.scenario_id:
        return {
            "success": True,
            "data": {"participation_id": existing.id, "scenario_id": existing.scenario_id}
        }

    start_date = datetime.now(KST)
    p = crud.create_participation(db, current_user.id, req.scenario_id, start_date)
    return {
        "success": True,
        "data": {"participation_id": p.id, "scenario_id": p.scenario_id, "start_date": start_date.isoformat()}
    }


# =====================================================================
# [게임 시뮬레이터] [DEV ONLY] 다음 일차로 강제 이동 - 테스트 전용, 배포 전 제거 필요
# =====================================================================

# TODO: 배포 전 이 엔드포인트 제거
@app.post("/api/game/participation/{participation_id}/dev/advance-day")
def dev_advance_day(
    participation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})
    p.start_date = p.start_date - timedelta(days=1)
    db.commit()
    new_today = _calc_today_index(p.start_date)
    return {"success": True, "data": {"today_index": new_today}}


# =====================================================================
# [게임 시뮬레이터] [DEV ONLY] 시나리오 진행 전체 초기화 - 테스트 전용, 배포 전 제거 필요
# =====================================================================

# TODO: 배포 전 이 엔드포인트 제거
@app.post("/api/game/dev/reset-all")
def dev_reset_all_participations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    all_participations = db.query(models.GameParticipation).filter(
        models.GameParticipation.user_id == current_user.id
    ).all()
    deleted_count = len(all_participations)
    for p in all_participations:
        db.delete(p)
    db.commit()
    return {"success": True, "data": {"deleted_count": deleted_count}}


# =====================================================================
# [게임 시뮬레이터] 참여 현황 전체 조회
# =====================================================================

def _calc_today_index(start_date, total_days: int = 7) -> int:
    """start_date 기준 경과일 → 1~7 (초과 시 total_days 고정)"""
    now = datetime.now(KST)
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=KST)
    elapsed = (now - start_date).days + 1
    return max(1, min(elapsed, total_days))


def _calc_portfolio_value(
    initial_cash: float,
    prev_value: float,                 # 어제 평가액 (Day1이면 initial_cash)
    prev_allocations: dict | None,     # 어제 배분 (Day1이면 None)
    prices_map: dict,                  # {asset: [D1, D2, ..., D7]}
    day_index: int,
) -> float:
    """
    오늘의 평가액 = 어제 평가액 × Σ(어제 비율 × 오늘가격/어제가격).
    Day1은 아직 운용 전이므로 initial_cash 그대로 반환.
    """
    if day_index <= 1 or not prev_allocations:
        return round(initial_cash, 2)

    factor = 0.0
    leftover_ratio = 100.0
    for asset, ratio in prev_allocations.items():
        if ratio <= 0:
            continue
        prices = prices_map.get(asset)
        if not prices or len(prices) < day_index:
            continue
        prev_price  = prices[day_index - 2]
        today_price = prices[day_index - 1]
        if not prev_price:
            continue
        factor += (ratio / 100) * (today_price / prev_price)
        leftover_ratio -= ratio
    # 미배분 비중은 현금 — 가격 변동 없으니 factor 1로 더해줌
    factor += max(leftover_ratio, 0) / 100
    return round(prev_value * factor, 2)


@app.get("/api/game/participation/{participation_id}")
def get_participation(
    participation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})

    scenario  = p.scenario
    today_idx = _calc_today_index(p.start_date)

    # 가격 데이터 구성 {asset: [D1..D7]}
    prices_rows = crud.get_prices_by_scenario(db, scenario.id)
    prices_map: dict[str, list] = {}
    for row in prices_rows:
        prices_map.setdefault(row.asset, [None] * 7)
        prices_map[row.asset][row.day_index - 1] = row.price

    # 거시지표 D1~오늘까지만
    macros_rows = crud.get_macros_by_scenario(db, scenario.id)
    macros = [
        {"day_index": m.day_index, "cpi": m.cpi, "interest_rate": m.interest_rate,
         "fx_usdkrw": m.fx_usdkrw, "vix": m.vix}
        for m in macros_rows if m.day_index <= today_idx
    ]

    # 뉴스 D1~오늘까지
    news_by_day = {}
    for day in range(1, today_idx + 1):
        news_rows = crud.get_news_by_scenario_and_day(db, scenario.id, day)
        news_by_day[day] = [
            {"slot": n.slot, "title": n.title, "description": n.description, "news_type": n.news_type, "hint": n.hint}
            for n in news_rows
        ]

    # 과거 allocation 내역
    alloc_rows = crud.get_allocations_by_participation(db, participation_id)
    allocations = [
        {"day_index": a.day_index, "allocations": a.allocations,
         "portfolio_value": a.portfolio_value, "return_rate": a.return_rate,
         "tags": a.tags or [], "memo": a.memo or ""}
        for a in alloc_rows
    ]

    # 현재 총 자산: 가장 최근 확정 평가액에서 출발해 오늘까지 같은 배분으로 누적 운용
    latest_alloc = alloc_rows[-1] if alloc_rows else None
    if latest_alloc:
        current_value = latest_alloc.portfolio_value
        for d in range(latest_alloc.day_index + 1, today_idx + 1):
            current_value = _calc_portfolio_value(
                p.initial_cash, current_value, latest_alloc.allocations, prices_map, d
            )
    else:
        current_value = p.initial_cash
    total_return = round((current_value - p.initial_cash) / p.initial_cash * 100, 2)

    return {
        "success": True,
        "data": {
            "participation_id": p.id,
            "scenario": {
                "id":       scenario.id,
                "stage":    scenario.season,
                "name":     scenario.name,
                "theme":    scenario.theme,
                "assets":   scenario.assets,
                "recap_text": scenario.recap_text,
                "key_lesson": scenario.key_lesson,
            },
            "today_index":    today_idx,
            "is_finalized":   p.is_finalized,
            "initial_cash":   p.initial_cash,
            "current_value":  current_value,
            "total_return":   total_return,
            "prices":         prices_map,
            "macros":         macros,
            "news_by_day":    news_by_day,
            "allocations":    allocations,
        }
    }


# =====================================================================
# [게임 시뮬레이터] 당일 매매 확정
# =====================================================================

@app.post("/api/game/participation/{participation_id}/allocate")
def allocate_game(
    participation_id: int,
    req: schemas.GameAllocateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})
    if p.is_finalized:
        return JSONResponse(status_code=400, content={"success": False, "message": "이미 종료된 시뮬레이션입니다."})

    today_idx = _calc_today_index(p.start_date)

    # 당일 이미 확정한 경우 방지
    existing = crud.get_allocation_by_day(db, participation_id, today_idx)
    if existing:
        return JSONResponse(status_code=400, content={"success": False, "message": "오늘 이미 매매를 확정했습니다."})

    # 가격 데이터 로드
    prices_rows = crud.get_prices_by_scenario(db, p.scenario_id)
    prices_map: dict[str, list] = {}
    for row in prices_rows:
        prices_map.setdefault(row.asset, [None] * 7)
        prices_map[row.asset][row.day_index - 1] = row.price

    # 가장 최근에 확정된 배분(ancestor) 찾기 — 중간에 미정산 일이 있어도 추적
    ancestor_alloc = None
    if today_idx > 1:
        for d in range(today_idx - 1, 0, -1):
            a = crud.get_allocation_by_day(db, participation_id, d)
            if a:
                ancestor_alloc = a
                break

    if ancestor_alloc:
        # ancestor 이후 ~ 어제까지 누락된 일자를 ancestor 배분 그대로 채우면서 누적 운용
        running_value = ancestor_alloc.portfolio_value
        for d in range(ancestor_alloc.day_index + 1, today_idx):
            running_value = _calc_portfolio_value(
                p.initial_cash, running_value, ancestor_alloc.allocations, prices_map, d
            )
            gap_return_rate = round((running_value - p.initial_cash) / p.initial_cash * 100, 2)
            crud.create_allocation(
                db, participation_id, d, ancestor_alloc.allocations, running_value, gap_return_rate
            )
        # 어제 → 오늘 운용 (ancestor 배분 기준)
        portfolio_value = _calc_portfolio_value(
            p.initial_cash, running_value, ancestor_alloc.allocations, prices_map, today_idx
        )
    else:
        # Day 1 첫 확정: 아직 운용 전
        portfolio_value = p.initial_cash
    return_rate = round((portfolio_value - p.initial_cash) / p.initial_cash * 100, 2)

    # 새 배분(req.allocations)은 오늘→내일 운용용으로 저장됨
    alloc = crud.create_allocation(
        db, participation_id, today_idx, req.allocations, portfolio_value, return_rate,
        tags=req.tags, memo=req.memo,
    )

    # Day 7 확정 시 자동 종료 + 점수 산출
    if today_idx >= 7:
        crud.finalize_participation(db, participation_id)
        try:
            scenario = crud.get_scenario_by_id(db, p.scenario_id)
            all_allocs = crud.get_allocations_by_participation(db, participation_id)
            scores = calculate_score(all_allocs, scenario)
            crud.save_game_result(db, participation_id, scores)
        except Exception as e:
            print(f"🚨 [점수 산출 오류] participation {participation_id}: {e}")

    return {
        "success": True,
        "data": {
            "day_index":       alloc.day_index,
            "portfolio_value": alloc.portfolio_value,
            "return_rate":     alloc.return_rate,
            "is_finalized":    today_idx >= 7,
        }
    }


# ─────────────────────────────────────────────────────────────────────
# [게임 시뮬레이터] 점수 조회
# ─────────────────────────────────────────────────────────────────────

@app.get("/api/game/participation/{participation_id}/score")
def get_game_score(
    participation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})

    result = crud.get_game_result(db, participation_id)
    if not result:
        return JSONResponse(status_code=404, content={"success": False, "message": "아직 점수가 산출되지 않았습니다."})

    rank_info = crud.get_rank_for_participation(db, participation_id)

    return {
        "success": True,
        "data": {
            "participation_id":        result.participation_id,
            "final_return":            result.final_return,
            "correct_strategy_return": result.correct_strategy_return,
            "return_score":            result.return_score,
            "scenario_score":          result.scenario_score,
            "diversity_score":         result.diversity_score,
            "stability_score":         result.stability_score,
            "total_score":             result.total_score,
            "rank":                    rank_info["rank"]       if rank_info else None,
            "total_participants":      rank_info["total"]      if rank_info else None,
            "percentile":              rank_info["percentile"] if rank_info else None,
        }
    }


# =====================================================================
# [게임 시뮬레이터] 자정 자동 정산 (스케줄러)
# =====================================================================

def _game_daily_settlement():
    """매일 자정: 당일 미확정 participation을 전날 배분 그대로 정산"""
    from database import SessionLocal
    db = SessionLocal()
    try:
        now = datetime.now(KST)
        print(f"⏰ [게임 정산] {now.strftime('%Y-%m-%d %H:%M')} 시작")

        active_list = db.query(models.GameParticipation).filter(
            models.GameParticipation.is_finalized == False
        ).all()
        print(f"   진행 중인 participation: {len(active_list)}개")

        settled, skipped, finalized = 0, 0, 0

        for p in active_list:
            today_idx = _calc_today_index(p.start_date)
            existing = crud.get_allocation_by_day(db, p.id, today_idx)
            if existing:
                skipped += 1
                continue

            # 가장 최근 확정 배분 찾기 (ancestor)
            ancestor_alloc = None
            for d in range(today_idx - 1, 0, -1):
                a = crud.get_allocation_by_day(db, p.id, d)
                if a:
                    ancestor_alloc = a
                    break
            if not ancestor_alloc:
                print(f"   ⚠️  participation {p.id} (user {p.user_id}): 이전 배분 기록 없음 — 스킵")
                skipped += 1
                continue

            prices_rows = crud.get_prices_by_scenario(db, p.scenario_id)
            prices_map: dict[str, list] = {}
            for row in prices_rows:
                prices_map.setdefault(row.asset, [None] * 7)
                prices_map[row.asset][row.day_index - 1] = row.price

            # ancestor 이후 ~ today_idx까지 누락된 일자 모두 채움 (ancestor 배분 그대로 누적)
            running_value = ancestor_alloc.portfolio_value
            for d in range(ancestor_alloc.day_index + 1, today_idx + 1):
                running_value = _calc_portfolio_value(
                    p.initial_cash, running_value, ancestor_alloc.allocations, prices_map, d
                )
                rr = round((running_value - p.initial_cash) / p.initial_cash * 100, 2)
                crud.create_allocation(db, p.id, d, ancestor_alloc.allocations, running_value, rr)
            settled += 1
            print(f"   ✅ participation {p.id} (user {p.user_id}) Day {ancestor_alloc.day_index + 1}~{today_idx} 자동 정산 — ₩{running_value:,.0f}")

            if today_idx >= 7:
                crud.finalize_participation(db, p.id)
                finalized += 1
                print(f"   🏁 participation {p.id} 시즌 종료 처리 완료")

        print(f"✅ [게임 정산] 완료 — 정산 {settled}건 / 종료 {finalized}건 / 스킵 {skipped}건")
    except Exception as e:
        print(f"🚨 [게임 정산 오류]: {e}")
    finally:
        db.close()