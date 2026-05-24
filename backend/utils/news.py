import os
import re
import json
import time
import requests
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup
from openai import OpenAI
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from db import crud
from db.session import get_db

KST = timezone(timedelta(hours=9))

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

TFIDF_SIMILARITY_THRESHOLD = 0.35


def clean_html(raw_html: str) -> str:
    clean_text = re.sub(r'<.*?>', '', raw_html)
    clean_text = re.sub(r'&quot;|&amp;|&lt;|&gt;|&apos;', ' ', clean_text)
    return clean_text.strip()


def scrape_naver_news_body(url: str) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
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


def analyze_news_with_gpt(title: str, full_text: str) -> dict:
    if not OPENAI_API_KEY:
        return {"category": "오류", "sentiment": "중립", "reason": "API 키 누락"}

    client = OpenAI(api_key=OPENAI_API_KEY)
    truncated_text = full_text[:3000]

    prompt = f"""당신은 전문 금융 애널리스트입니다.
다음 뉴스 기사의 제목과 본문을 심층 분석하여, 반드시 아래의 JSON 형식으로만 응답해 주세요.

[뉴스 기사]
제목: {title}
본문: {truncated_text}

[출력 형식 (JSON)]
{{
    "category": "주식, ETF, 예적금, 채권, 암호화폐, 원화, 금, 기타 중 반드시 택1",
    "sentiment": "호재, 악재, 중립 중 반드시 택1",
    "tag": "반도체, 디스플레이, IT, 게임, AI, 로봇, 통신/네트워크, 자동차, 배터리, 조선, 우주항공, 방산, 바이오, 헬스케어, 금융, 증권, 가상자산/핀테크, 철강/금속, 화학/정유, 건설/건자재, 유통/소비재, 화장품/의류, 음식료, 엔터테인먼트/미디어, 여행/항공, 에너지/환경, 전력/유틸리티, 기타 중 기사 본문의 핵심 주제와 가장 밀접한 것 반드시 택1",
    "reason": "이 기사가 왜 해당 감성(호재/악재/중립)인지 본문 내용을 바탕으로 50자 이내로 명확하게 존댓말로 작성"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"🚨 GPT 분석 에러: {e}", flush=True)
        return {"category": "오류", "sentiment": "중립", "reason": "분석 실패"}


def _build_tfidf(titles: list[str]):
    if not titles:
        return None, None
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 3))
    return vec, vec.fit_transform(titles)


def run_news_pipeline():
    print(f"📰 뉴스 파이프라인 가동 ({datetime.now(KST).strftime('%H:%M:%S')} KST)", flush=True)
    db: Session = next(get_db())

    try:
        deleted_news_count = crud.delete_old_news(db, days_to_keep=3)
        if deleted_news_count > 0:
            print(f"🧹 보관 기간(3일)이 경과한 뉴스 {deleted_news_count}개를 삭제했습니다.", flush=True)
        else:
            print("🧹 삭제할 오래된 뉴스 기사가 없습니다. 현재 DB가 깔끔한 상태입니다.", flush=True)

        existing_news: list[tuple[int, str]] = crud.get_all_news_titles(db)
        existing_titles: list[str] = [title for _, title in existing_news]

        vectorizer, tfidf_matrix = _build_tfidf(existing_titles)
        print(f"📋 기존 뉴스 {len(existing_titles)}개 TF-IDF 벡터화 완료 (중복 검사 기준)", flush=True)

        url = "https://openapi.naver.com/v1/search/news.json"
        headers = {"X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET}

        now_utc = datetime.now(timezone.utc)
        start_of_today = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)

        target_keywords = [
            "주식", "증시", "금리", "환율", "코인",
            "채권", "원자재", "금", "은", "원화, 속보",
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

                if crud.get_news_by_link(db, link):
                    link_skip_count += 1
                    continue

                title = clean_html(item.get("title", ""))

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
                ai_result = analyze_news_with_gpt(title, full_text)
                execution_time = time.time() - start_time
                print(f"⏱️ 분석 완료. 소요 시간: {execution_time:.2f}초", flush=True)

                news_data = {
                    "title":       title,
                    "link":        link,
                    "description": description,
                    "category":    ai_result.get("category", "오류"),
                    "sentiment":   ai_result.get("sentiment", "중립"),
                    "tag":         ai_result.get("tag", "기타"),
                    "reason":      ai_result.get("reason", "분석 실패"),
                    "pub_date":    pub_date_str,
                    "created_at":  now_utc,
                }

                saved_news = crud.create_news(db, news_data)
                existing_news.append((saved_news.id, title))
                existing_titles.append(title)
                vectorizer, tfidf_matrix = _build_tfidf(existing_titles)
                total_saved += 1
                print(f"✅ 뉴스 적재 완료 [{keyword}] - {ai_result.get('sentiment')}: {ai_result.get('reason')}", flush=True)

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
