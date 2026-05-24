from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import models, schemas
from db.session import get_db
from dependencies import get_current_user

router = APIRouter()


@router.get("/api/user/me")
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "nickname":      current_user.nickname,
            "profile_image": current_user.profile_image,
        },
    }


@router.patch("/api/user/nickname")
def update_nickname(
    req: schemas.NicknameUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    nickname = req.nickname.strip()
    if not nickname:
        raise HTTPException(status_code=400, detail="닉네임을 입력해주세요.")
    if len(nickname) > 20:
        raise HTTPException(status_code=400, detail="닉네임은 20자 이하여야 합니다.")
    current_user.nickname = nickname
    db.commit()
    db.refresh(current_user)
    return {"success": True, "data": {"nickname": current_user.nickname}}


@router.delete("/api/user/me")
def delete_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.delete(current_user)
    db.commit()
    return {"success": True, "data": {"deleted": True}}
