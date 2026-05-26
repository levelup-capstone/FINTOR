from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from db import models, schemas, crud
from db.session import get_db
from dependencies import get_current_user

KST = timezone(timedelta(hours=9))

router = APIRouter()



# ── 일일 퀴즈 ─────────────────────────────────────────────────────────────────
@router.get("/api/quiz/today")
def get_today_quiz(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today_kst = datetime.now(KST).date()
    completion = crud.get_daily_completion(db, current_user.id, today_kst)
    current_streak = crud.get_current_streak(db, current_user.id, today_kst)

    # 틀린 문제에 높은 가중치를 부여하여 복습 효과를 높이는 방식으로 6문제 선정
    questions = crud.select_weighted_questions(db, current_user.id, n=6)
    if not questions:
        return JSONResponse(status_code=404, content={"success": False, "message": "퀴즈 문제를 불러올 수 없습니다."})

    items = [
        {
            "id":        q.id,
            "category":  q.category,
            "quiz_type": q.quiz_type,
            "question":  q.question,
            "options":   q.options,
            "is_solved": False,
        }
        for q in questions
    ]

    return {
        "success": True,
        "data": {
            "questions":         items,
            "today_total":       len(items),
            "already_completed": completion is not None,
            "current_streak":    current_streak,
            "completion": {
                "correct_count": completion.correct_count,
                "total":         completion.total,
                "streak":        completion.streak,
                "results":       completion.results,
            } if completion else None,
        },
    }


@router.post("/api/quiz/daily/complete")
def complete_daily_quiz(
    req: schemas.QuizDailyCompleteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today_kst = datetime.now(KST).date()

    # 중복 EXP 방지: 이미 오늘 completion이 있으면 EXP 부여 안 함
    already_done = crud.get_daily_completion(db, current_user.id, today_kst) is not None

    entry = crud.save_daily_completion(
        db,
        user_id=current_user.id,
        date=today_kst,
        correct_count=req.correct_count,
        total=req.total,
        streak=req.streak,
        results=req.results,
    )

    # EXP 부여: 정답 1개당 +3, 만점 보너스 +5, streak milestone 보너스
    granted = 0
    new_level = None
    new_exp = None
    leveled_up = False
    gained_levels = 0
    milestone_bonus = 0
    milestone_reached = None

    # streak milestone 보상표 (10/30/100일 달성 시 추가 EXP)
    MILESTONE_BONUS = {10: 10, 30: 50, 100: 200}

    if not already_done:
        base = req.correct_count * 3
        bonus = 5 if req.total > 0 and req.correct_count == req.total else 0

        if req.streak in MILESTONE_BONUS:
            milestone_bonus = MILESTONE_BONUS[req.streak]
            milestone_reached = req.streak

        amount = base + bonus + milestone_bonus
        if amount > 0:
            exp_result = crud.grant_exp(db, current_user.id, amount)
            granted       = exp_result["granted"]
            new_level     = exp_result["level"]
            new_exp       = exp_result["exp"]
            leveled_up    = exp_result["leveled_up"]
            gained_levels = exp_result["gained_levels"]

    return {
        "success": True,
        "data": {
            "date":              str(entry.date),
            "granted_exp":       granted,
            "new_level":         new_level,
            "new_exp":           new_exp,
            "leveled_up":        leveled_up,
            "gained_levels":     gained_levels,
            "milestone_bonus":   milestone_bonus,
            "milestone_reached": milestone_reached,
        },
    }


@router.post("/api/quiz/{question_id}/submit")
def submit_quiz(
    question_id: int,
    req: schemas.QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    question = crud.get_quiz_question_by_id(db, question_id)
    if not question:
        return JSONResponse(status_code=404, content={"success": False, "message": "문제를 찾을 수 없습니다."})

    is_correct = req.selected_answer.strip() == question.answer.strip()
    # 정답 여부를 QuizUserProgress에 반영하여 가중치 갱신 (일일 퀴즈 전용)
    result = crud.submit_quiz_answer(
        db,
        user_id=current_user.id,
        question_id=question_id,
        selected_answer=req.selected_answer,
        is_correct=is_correct,
    )

    return {
        "success": True,
        "data": {
            "is_correct":     result["is_correct"],
            "correct_answer": question.answer,
            "explanation":    question.explanation,
            "weight":         result["weight"],
            "correct_streak": result["correct_streak"],
        },
    }



# ── 무한 퀴즈 ─────────────────────────────────────────────────────────────────
@router.post("/api/quiz/{question_id}/check")
def check_quiz_answer(
    question_id: int,
    req: schemas.QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # 정답 확인만 수행 — QuizUserProgress를 건드리지 않아 일일 퀴즈 가중치에 영향 없음
    question = crud.get_quiz_question_by_id(db, question_id)
    if not question:
        return JSONResponse(status_code=404, content={"success": False, "message": "문제를 찾을 수 없습니다."})

    is_correct = req.selected_answer.strip() == question.answer.strip()
    return {
        "success": True,
        "data": {
            "is_correct":     is_correct,
            "correct_answer": question.answer,
            "explanation":    question.explanation,
            "weight":         0,
            "correct_streak": 0,
        },
    }


@router.get("/api/quiz/pool")
def get_quiz_pool(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # 무한 퀴즈용 문제 풀 — 일일 퀴즈(6문제)보다 많은 20문제 반환
    questions = crud.select_weighted_questions(db, current_user.id, n=20)
    items = [
        {
            "id":        q.id,
            "category":  q.category,
            "quiz_type": q.quiz_type,
            "question":  q.question,
            "options":   q.options,
            "is_solved": False,
        }
        for q in questions
    ]
    return {"success": True, "data": {"questions": items}}


@router.post("/api/quiz/infinite/score")
def submit_quiz_infinite_score(
    req: schemas.QuizInfiniteScoreRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.submit_infinite_score(db, current_user.id, req.score)
    return {"success": True, "data": result}



# ── 현황 및 랭킹 ───────────────────────────────────────────────────────────────
@router.get("/api/quiz/status")
def get_quiz_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    status = crud.get_quiz_status(db, current_user.id)
    today_kst = datetime.now(KST).date()
    completion = crud.get_daily_completion(db, current_user.id, today_kst)
    streak = crud.get_current_streak(db, current_user.id, today_kst)
    return {
        "success": True,
        "data": {
            **status,
            "streak": streak,
            "today_done": completion is not None,
            "today_completion": {
                "correct_count": completion.correct_count,
                "total":         completion.total,
                "results":       completion.results,
            } if completion else None,
        },
    }


@router.get("/api/quiz/ranking")
def get_quiz_ranking_endpoint(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = crud.get_quiz_ranking(db, current_user.id)
    return {"success": True, "data": data}


# TODO: 배포 전 이 엔드포인트 제거
@router.post("/api/quiz/dev/advance-season")
def dev_advance_season(db: Session = Depends(get_db)):
    result = crud.dev_force_end_season(db)
    return {"success": True, "data": result}


# TODO: 배포 전 이 엔드포인트 제거
@router.post("/api/quiz/dev/reset-daily")
def dev_reset_daily_quiz(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today_kst = datetime.now(KST).date()
    completion = crud.get_daily_completion(db, current_user.id, today_kst)
    if completion:
        db.delete(completion)
        db.commit()
        return {"success": True, "data": {"deleted": True}}
    return {"success": True, "data": {"deleted": False}}
