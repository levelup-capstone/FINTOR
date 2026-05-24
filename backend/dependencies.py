import os
import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db import models
from db.session import get_db

JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
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


def create_jwt_token(user_id: int, expires_delta: timedelta) -> str:
    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")
