from pydantic import BaseModel
from typing import Optional

# 1. 프론트에서 받는 데이터 (인가 코드로 변경됨!)
class KakaoLoginRequest(BaseModel):
    code: str

# 2. 로그인 완료 데이터 구조
class LoginData(BaseModel):
    accessToken: str
    refreshToken: str
    userId: int
    nickname: str
    profileImage: Optional[str] = None
    isNewUser: bool
    redirectUrl: str

# 3. 최종 응답 구조
class LoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[LoginData] = None