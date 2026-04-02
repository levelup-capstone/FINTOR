from pydantic import BaseModel
from typing import Optional, List

# 1. 인증(Auth) 관련 스키마
class KakaoLoginRequest(BaseModel):
    code: str

class LoginData(BaseModel):
    accessToken: str
    refreshToken: str
    userId: int
    nickname: str
    profileImage: Optional[str] = None
    isNewUser: bool
    redirectUrl: str

class LoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[LoginData] = None

# 2. 설문조사(Survey) 관련 스키마
class SurveyCreate(BaseModel):
    age_group: str
    investment_experience: str
    preferred_period: str
    preferred_assets: List[str]
    risk_type: str
    investment_assets: str
    monthly_income: str
    investment_goal: str

# 💡 [추가] 자산 배분 상세 스키마
class AllocationItem(BaseModel):
    asset: str
    ratio: int

# 💡 [추가] 포트폴리오 단일 항목 스키마
class PortfolioItem(BaseModel):
    id: str
    name: str
    allocations: List[AllocationItem]

# 💡 [추가] /api/survey 응답 데이터 구조
class SurveyResponseData(BaseModel):
    portfolios: List[PortfolioItem]

# 💡 [추가] 최종 Survey API 응답 스키마
class SurveyResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[SurveyResponseData] = None