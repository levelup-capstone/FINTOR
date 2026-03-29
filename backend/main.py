import os
import jwt
import requests
from datetime import datetime, timedelta, date

from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

import models, schemas, crud
from database import engine, get_db
from models import User, Attendance
# DB 테이블 생성
print("만들어져야 하는 테이블 : ", models.Base.metadata.tables.keys())
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fintor Auth Server")

# --- [CORS 설정] ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- [환경 변수] ---
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET")
KAKAO_REDIRECT_URI = os.getenv("KAKAO_REDIRECT_URI")

# --- [JWT 생성] ---
def create_jwt_token(user_id: int, expires_delta: timedelta):
    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")


# --- [JWT 인증 - 핵심] ---
security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = int(payload.get("sub"))
    except:
        raise HTTPException(status_code=401, detail="토큰 오류")

    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="유저 없음")
    
    return user


# --- [카카오 로그인] ---
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
        return JSONResponse(status_code=400, content={
            "success": False,
            "message": f"카카오 에러: {error_detail.get('error_description', 'Auth Failed')}",
            "data": None
        })

    kakao_access_token = token_res.json().get("access_token")

    # 유저 정보 요청
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

    # JWT 발급
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


# --- [로그아웃] ---
@app.post("/api/auth/logout")
def logout():
    return {
        "success": True,
        "message": "로그아웃 처리 완료"
    }


# --- [출석 체크 API ⭐] ---
@app.post("/api/attendance/check")
def check_attendance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    today = date.today()

    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.date == today
    ).first()

    if existing:
        return {"success": False, "message": "이미 출석함"}

    attendance = models.Attendance(
        user_id=current_user.id,
        date=today
    )

    db.add(attendance)
    db.commit()

    return {"success": True, "message": "출석 완료"}


# --- [출석 조회 API] ---
@app.get("/api/attendance")
def get_attendance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    records = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id
    ).all()

    return records