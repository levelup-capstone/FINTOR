import os
import jwt
import requests
import time
import yfinance as yf
import finnhub
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

import models, schemas, crud
from database import engine, get_db

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fintor Auth Server")

DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"
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

# Finnhub 클라이언트 초기화
finnhub_client = finnhub.Client(api_key=FINNHUB_API_KEY)


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

def get_kis_access_token():
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
        return res.json().get("access_token")
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

def fetch_yfinance_quote(name: str, symbol: str) -> dict | None:
    try:
        time.sleep(0.5)
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="2d")

        if hist.empty:
            print(f"⚠️ yfinance [{name}] 데이터 없음")
            return None

        current = float(hist["Close"].iloc[-1])
        prev    = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
        change_value = round(current - prev, 4)
        change_rate  = round((change_value / prev * 100) if prev != 0 else 0, 2)

        return {
            "price":        round(current, 4),
            "change_value": change_value,
            "change_rate":  change_rate,
            "source":       "yfinance"
        }
    except Exception as e:
        print(f"🚨 yfinance [{name}] 오류: {str(e)}")
        return None


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

        # 3. yfinance: 나머지 + Finnhub fallback
        for name, symbol in YFINANCE_SYMBOLS.items():
            if name in all_results and all_results[name].get("source") == "finnhub":
                continue
            data = fetch_yfinance_quote(name, symbol)
            if data:
                all_results[name] = data

        # DB 저장 (upsert 방식 - 있으면 업데이트, 없으면 삽입)
        for name, data in all_results.items():
            crud.upsert_market_index(db, name=name, data=data, updated_at=now)

        print(f"✅ 시장 데이터 저장 완료 ({len(all_results)}개)")

    except Exception as e:
        print(f"🚨 시장 데이터 수집 오류: {str(e)}")
    finally:
        db.close()


# =====================================================================
# [백그라운드 스케줄러] 5분마다 자동 수집
# =====================================================================
scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup_event():
    # 서버 시작 시 최초 1회 즉시 실행
    collect_and_save_market_data()

    # DEV_MODE면 1분, 아니면 5분마다 실행
    interval = 1 if DEV_MODE else 5
    scheduler.add_job(collect_and_save_market_data, "interval", minutes=interval)
    scheduler.start()
    print(f"⏰ 스케줄러 시작 ({interval}분 간격)")

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
    for row in rows:
        data[row.name] = {
            "price":        row.price,
            "change_rate":  row.change_rate,
            "change_value": row.change_value,
            "source":       row.source,
            "updated_at":   row.updated_at.isoformat()
        }

    return {
        "success": True,
        "message": "시장 지표 데이터 조회 완료",
        "data": data
    }