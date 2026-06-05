import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from db import models
from db.session import engine, get_db
from seeds.game_seed import seed as run_game_seed
from seeds.quiz_seed import seed as run_quiz_seed

from utils.market import collect_and_save_market_data
from utils.news import run_news_pipeline
from db.crud import get_or_create_current_season, distribute_season_exp

from routers import auth, market, survey, game, quiz, user



# ── DB 초기화 ─────────────────────────────────────────────────────────────────
# models.py에 정의된 모든 테이블을 DB에 생성 (이미 존재하면 스킵)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fintor Auth Server")



# ── CORS 설정 ─────────────────────────────────────────────────────────────────
# 프론트엔드(localhost:3000)에서의 요청만 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ── 라우터 등록 ───────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(market.router)
app.include_router(survey.router)
app.include_router(game.router)
app.include_router(quiz.router)
app.include_router(user.router)



# ── 스케줄러 ──────────────────────────────────────────────────────────────────
scheduler = BackgroundScheduler()


@app.on_event("startup")
def startup_event():
    print("🏢 운영 모드입니다.")

    # 시드 데이터: 게임 시나리오·퀴즈 문제가 없으면 초기 데이터 삽입
    try:
        run_game_seed()
    except Exception as e:
        print(f"⚠️ 게임 시드 실패 (서버 계속 시작): {e}")

    db = next(get_db())
    try:
        run_quiz_seed(db)
    except Exception as e:
        print(f"⚠️ 퀴즈 시드 실패 (서버 계속 시작): {e}")
    finally:
        db.close()

    # 서버 시작 직후 시장 데이터·뉴스를 즉시 1회 수집 (스케줄 첫 실행 전 공백 방지)
    threading.Thread(target=collect_and_save_market_data, daemon=True).start()
    threading.Thread(target=run_news_pipeline, daemon=True).start()

    # 퀴즈 시즌이 없으면 시즌 1을 즉시 생성
    season_db = next(get_db())
    try:
        get_or_create_current_season(season_db)
    except Exception as e:
        print(f"⚠️ 시즌 생성 실패 (서버 계속 시작): {e}")
    finally:
        season_db.close()

    def _run_distribute_season_exp():
        dist_db = next(get_db())
        try:
            distribute_season_exp(dist_db)
        finally:
            dist_db.close()

    # 주기적 수집: 시장 지수 5분 / 뉴스 30분 / 시즌 종료 EXP 지급 1시간
    scheduler.add_job(collect_and_save_market_data, "interval", minutes=5)
    scheduler.add_job(run_news_pipeline, "interval", minutes=30)
    scheduler.add_job(_run_distribute_season_exp, "interval", hours=1)
    scheduler.start()
    print("⏰ 스케줄러 시작 (지수 5분 / 뉴스 30분 / 시즌 EXP 1시간)")


@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()
    print("⏰ 스케줄러 종료")
