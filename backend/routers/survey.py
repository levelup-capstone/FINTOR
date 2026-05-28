from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from db import models, schemas, crud
from db.session import get_db
from dependencies import get_current_user
from utils.scoring import calc_risk_score, score_to_level, RISK_LABELS

router = APIRouter()


@router.post("/api/survey", response_model=schemas.SurveyResponse)
def submit_survey(
    survey_data: schemas.SurveyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        # 설문은 1인 1회만 허용 — 중복 제출 차단
        existing_survey = db.query(models.Survey).filter(models.Survey.user_id == current_user.id).first()
        if existing_survey:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "이미 설문을 완료한 사용자입니다.",
                "data": None,
            })

        # 답변 점수 합산 → 위험 성향 레벨(1~5) 산출
        score      = calc_risk_score(survey_data)
        risk_level = score_to_level(score)
        risk_label = RISK_LABELS[risk_level]

        new_survey = models.Survey(
            user_id=current_user.id,
            risk_level=risk_level,
            **survey_data.model_dump()
        )
        db.add(new_survey)
        db.commit()

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
            "message": "서버 내부 오류로 인해 데이터를 저장하지 못했습니다.",
        })


@router.get("/api/v1/users/{user_id}/level")
def get_user_level(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id=user_id)
    if not user:
        return JSONResponse(status_code=404, content={
            "success": False,
            "error": {"code": "USER_NOT_FOUND", "message": "해당 사용자를 찾을 수 없습니다."},
        })

    user_level = crud.get_user_level(db, user_id=user_id)

    # 레벨 레코드가 없으면 초기값(lv.1, exp=0)으로 생성
    if not user_level:
        user_level = crud.create_user_level(db, user_id=user_id)

    survey = db.query(models.Survey).filter(models.Survey.user_id == user_id).first()

    return {
        "success": True,
        "data": {
            "userId":    user_id,
            "level":     user_level.level,
            "exp":       user_level.exp,
            "riskType":  RISK_LABELS[survey.risk_level] if survey and survey.risk_level else None,
            "updatedAt": user_level.updated_at.isoformat() if user_level.updated_at else None,
        },
    }
