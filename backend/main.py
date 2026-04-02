import os
import jwt
import requests
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session

import models, schemas, crud
from database import engine, get_db

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fintor API Server")

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

# --- [보안(Security) 설정] ---
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="토큰 검증에 실패했습니다.")
    
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user

def create_jwt_token(user_id: int, expires_delta: timedelta):
    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")

# --- [예외 처리] ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("\n========================================")
    print("🚨 [데이터 검증 실패] 프론트엔드 데이터가 스키마와 일치하지 않습니다!")
    print(f"👉 틀린 항목 상세: {exc.errors()}")
    print(f"👉 프론트에서 보낸 원본 데이터: {exc.body}")
    print("========================================\n")
    return JSONResponse(
        status_code=422,
        content={
            "success": False, 
            "message": "데이터 형식이 맞지 않습니다.", 
            "detail": exc.errors()
        }
    )

# ==========================================
# 1. 인증(Auth) API
# ==========================================

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
    if not db_user:
        db_user = crud.create_user(db, kakao_id, nickname, profile_image)

    existing_survey = db.query(models.Survey).filter(models.Survey.user_id == db_user.id).first()
    
    is_new_user = True if not existing_survey else False
    redirect_url = "/survey" if is_new_user else "/dashboard"
    msg = "로그인 성공 (설문 필요)" if is_new_user else "로그인 성공 (설문 완료)"

    service_access_token = create_jwt_token(db_user.id, timedelta(hours=2))
    service_refresh_token = create_jwt_token(db_user.id, timedelta(days=14))

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

# ==========================================
# 2. 설문조사(Survey) API
# ==========================================

@app.post("/api/survey", response_model=schemas.SurveyResponse)
def submit_survey(
    survey_data: schemas.SurveyCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        existing_survey = db.query(models.Survey).filter(models.Survey.user_id == current_user.id).first()
        if existing_survey:
            return JSONResponse(status_code=400, content={
                "success": False, 
                "message": "이미 설문을 완료한 사용자입니다.",
                "data": None
            })
        
        # 설문 데이터 DB 저장
        new_survey = models.Survey(
            user_id=current_user.id,
            **survey_data.dict()
        )
        db.add(new_survey)
        db.commit()
        
        # 💡 [변경] 프론트엔드에 전달할 더미 포트폴리오 데이터 구성
        dummy_portfolios = [
            {
                "id": "stable",
                "name": "안정형",
                "allocations": [
                    { "asset": "deposit", "ratio": 35 },
                    { "asset": "bonds", "ratio": 30 },
                    { "asset": "bluechip-stock", "ratio": 20 },
                    { "asset": "gold", "ratio": 10 },
                    { "asset": "krw", "ratio": 5 }
                ]
            },
            {
                "id": "risk-neutral",
                "name": "위험중립형",
                "allocations": [
                    { "asset": "etf", "ratio": 30 },
                    { "asset": "bluechip-stock", "ratio": 30 },
                    { "asset": "growth-stock", "ratio": 20 },
                    { "asset": "bonds", "ratio": 10 },
                    { "asset": "krw", "ratio": 10 }
                ]
            },
            {
                "id": "aggressive",
                "name": "공격투자형",
                "allocations": [
                    { "asset": "growth-stock", "ratio": 40 },
                    { "asset": "coin", "ratio": 30 },
                    { "asset": "etf", "ratio": 20 },
                    { "asset": "krw", "ratio": 10 }
                ]
            }
        ]
        
        return {
            "success": True, 
            "message": "설문이 성공적으로 저장되었습니다.",
            "data": {
                "portfolios": dummy_portfolios
            }
        }
        
    except Exception as e:
        db.rollback()
        print(f"🚨 [DB 저장 에러] 치명적 오류 발생: {e}")
        return JSONResponse(status_code=500, content={
            "success": False, 
            "message": "서버 내부 오류로 인해 데이터를 저장하지 못했습니다."
        })