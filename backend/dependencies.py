import os
import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db import models
from db.session import get_db

# ── JWT 설정 ──────────────────────────────────────────────────────────────────
# 서버 기동 시 환경변수 누락이면 즉시 KeyError로 실패하도록 [] 사용
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
# Authorization: Bearer <token> 헤더를 파싱하는 FastAPI 보안 스킴
security = HTTPBearer()


# ── 인증 의존성 ───────────────────────────────────────────────────────────────
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """JWT를 검증하고 DB에서 유저 객체를 반환한다. 인증이 필요한 모든 라우터에서 Depends로 주입."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
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


# ── JWT 발급 ──────────────────────────────────────────────────────────────────
def create_jwt_token(user_id: int, expires_delta: timedelta) -> str:
    """user_id를 sub 클레임으로 담은 HS256 JWT를 발급한다."""
    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")
