import os
import jwt
import requests
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models, schemas, crud
from database import engine, get_db

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fintor Auth Server")

# --- [CORS 설정] ---
# 프론트엔드(React)와의 원활한 통신을 위한 허용 정책 설정
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

# [유틸리티] 자체 서비스용 JWT 토큰 생성
# 유저 ID를 기반으로 액세스 및 리프레시 토큰 발급
def create_jwt_token(user_id: int, expires_delta: timedelta):
    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")

# [핵심 API] 카카오 소셜 로그인 엔드포인트
# 인가 코드 -> 카카오 토큰 발급 -> 유저 정보 조회 -> DB 저장 -> 자체 토큰 발급 프로세스
@app.post("/api/auth/kakao/login", response_model=schemas.LoginResponse)
def kakao_login(req: schemas.KakaoLoginRequest, db: Session = Depends(get_db)):
    
    # 1. 카카오 서버에 Access Token 요청 (OAuth 2.0 Step 2)
    token_url = "https://kauth.kakao.com/oauth/token"
    token_payload = {
        "grant_type": "authorization_code",
        "client_id": KAKAO_REST_API_KEY,
        "redirect_uri": KAKAO_REDIRECT_URI,
        "code": req.code,
        "client_secret": KAKAO_CLIENT_SECRET
    }
    
    token_res = requests.post(token_url, data=token_payload)
    
    # 카카오 토큰 발급 실패 예외 처리
    if token_res.status_code != 200:
        error_detail = token_res.json()
        print(f"🚨 Kakao Token Error: {error_detail}")
        return JSONResponse(status_code=400, content={
            "success": False, 
            "message": f"카카오 에러: {error_detail.get('error_description', 'Auth Failed')}", 
            "data": None
        })
    
    kakao_access_token = token_res.json().get("access_token")

    # 2. 카카오 사용자 정보 조회 API 호출
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
    
    # 유저 프로필 추출 (기본값 설정 포함)
    nickname = properties.get("nickname", "Unknown")
    profile_image = properties.get("profile_image", "")

    # 3. 회원 가입 처리 및 DB 연동
    # 가입 이력이 없다면 신규 생성, 있다면 기존 유저 정보 로드
    db_user = crud.get_user_by_kakao_id(db, kakao_id=kakao_id)
    is_new_user = False

    if not db_user:
        is_new_user = True
        db_user = crud.create_user(db, kakao_id, nickname, profile_image)

    # 4. 서비스 전용 자체 JWT 토큰 생성
    # Access Token(2시간), Refresh Token(14일)
    service_access_token = create_jwt_token(db_user.id, timedelta(hours=2))
    service_refresh_token = create_jwt_token(db_user.id, timedelta(days=14))

    # 신규/기존 유저 여부에 따른 응답 메시지 및 리다이렉트 경로 설정
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

# [API] 로그아웃 엔드포인트
# 현재는 성공 응답만 반환하며, 실제 블랙리스트 등은 프론트엔드와 협의 후 추가 가능
@app.post("/api/auth/logout")
def logout():
    return {
        "success": True, 
        "message": "로그아웃 처리가 완료되었습니다."
    }