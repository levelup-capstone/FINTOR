import threading
from datetime import timedelta, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from db import models
from db.session import engine, get_db
from seeds.game import seed as run_game_seed
from seeds.quiz import seed as run_quiz_seed

from utils.market import collect_and_save_market_data
from utils.news import run_news_pipeline
from routers.game import _game_daily_settlement

from routers import auth, market, survey, game, quiz, user

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fintor Auth Server")

KST = timezone(timedelta(hours=9))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(market.router)
app.include_router(survey.router)
app.include_router(game.router)
app.include_router(quiz.router)
app.include_router(user.router)

scheduler = BackgroundScheduler()


@app.on_event("startup")
def startup_event():
    print("🏢 운영 모드입니다.")

    run_game_seed()
    db = next(get_db())
    try:
        run_quiz_seed(db)
    finally:
        db.close()

    threading.Thread(target=collect_and_save_market_data, daemon=True).start()
    threading.Thread(target=run_news_pipeline, daemon=True).start()

    scheduler.add_job(collect_and_save_market_data, "interval", minutes=5)
    scheduler.add_job(run_news_pipeline, "interval", minutes=30)
    scheduler.add_job(_game_daily_settlement, "cron", hour=0, minute=0, timezone=KST)
    scheduler.start()
    print("⏰ 스케줄러 시작 (지수 5분 / 뉴스 30분 / 게임 정산 매일 자정 KST)")


@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()
    print("⏰ 스케줄러 종료")
