import os
import requests
from datetime import timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from db import crud, schemas
from db.session import get_db
from dependencies import create_jwt_token



# ── 카카오 OAuth 환경변수 ──────────────────────────────────────────────────────
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET")
KAKAO_REDIRECT_URI = os.getenv("KAKAO_REDIRECT_URI")

router = APIRouter()


@router.post("/api/auth/kakao/login", response_model=schemas.LoginResponse)
def kakao_login(req: schemas.KakaoLoginRequest, db: Session = Depends(get_db)):
    # ── 1단계: 인가 코드 → 카카오 액세스 토큰 교환 ─────────────────────────────
    token_url = "https://kauth.kakao.com/oauth/token"
    token_payload = {
        "grant_type": "authorization_code",
        "client_id": KAKAO_REST_API_KEY,
        "redirect_uri": KAKAO_REDIRECT_URI,
        "code": req.code,
        "client_secret": KAKAO_CLIENT_SECRET,
    }

    token_res = requests.post(token_url, data=token_payload)
    if token_res.status_code != 200:
        error_detail = token_res.json()
        print(f"🚨 Kakao Token Error: {error_detail}")
        return JSONResponse(status_code=400, content={
            "success": False,
            "message": f"카카오 에러: {error_detail.get('error_description', 'Auth Failed')}",
            "data": None,
        })

    # ── 2단계: 카카오 액세스 토큰으로 유저 정보 조회 ────────────────────────────
    kakao_access_token = token_res.json().get("access_token")
    user_info_url = "https://kapi.kakao.com/v2/user/me"
    headers = {"Authorization": f"Bearer {kakao_access_token}"}
    user_res = requests.get(user_info_url, headers=headers)

    if user_res.status_code != 200:
        return JSONResponse(status_code=401, content={
            "success": False, "message": "카카오 유저 정보 조회 실패", "data": None,
        })

    user_data = user_res.json()
    kakao_id = str(user_data.get("id"))
    properties = user_data.get("properties", {})
    nickname = properties.get("nickname", "Unknown")
    profile_image = properties.get("profile_image", "")

    # ── 3단계: DB 조회 후 없으면 신규 가입, 있으면 기존 로그인 ───────────────────
    db_user = crud.get_user_by_kakao_id(db, kakao_id=kakao_id)
    is_new_user = False
    if not db_user:
        is_new_user = True
        db_user = crud.create_user(db, kakao_id, nickname, profile_image)

    # 신규 유저는 설문 페이지로, 기존 유저는 대시보드로 리다이렉트
    service_access_token = create_jwt_token(db_user.id, timedelta(hours=2))
    service_refresh_token = create_jwt_token(db_user.id, timedelta(days=14))
    redirect_url = "/survey" if is_new_user else "/dashboard"
    msg = "회원가입 성공 (신규)" if is_new_user else "로그인 성공 (기존)"

    return {
        "success": True,
        "message": msg,
        "data": {
            "accessToken":    service_access_token,
            "refreshToken":   service_refresh_token,
            "userId":         db_user.id,
            "nickname":       db_user.nickname,
            "profileImage":   db_user.profile_image,
            "isNewUser":      is_new_user,
            "redirectUrl":    redirect_url,
        },
    }


@router.post("/api/auth/logout")
def logout():
    # JWT는 서버에 저장되지 않으므로 클라이언트가 토큰을 삭제하는 것으로 로그아웃 처리
    return {"success": True, "message": "로그아웃 처리가 완료되었습니다."}
