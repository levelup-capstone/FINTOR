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

class AllocationItem(BaseModel):
    asset: str
    ratio: int

class PortfolioItem(BaseModel):
    id: str
    name: str
    allocations: List[AllocationItem]

class SurveyResponseData(BaseModel):
    portfolios: List[PortfolioItem]

class SurveyResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[SurveyResponseData] = None

# 3. 포트폴리오(Portfolio) 관련 스키마
class PortfolioCreate(BaseModel):
    userid: int
    id: str        # "stable", "aggressive" 등 성향 식별자
    name: str      # "안정형", "공격형" 등
    allocations: List[AllocationItem]

class PortfolioDetail(BaseModel):
    id: str
    name: str
    allocations: List[AllocationItem]

class PortfolioResponseData(BaseModel):
    portfolios: PortfolioDetail

class PortfolioResponse(BaseModel):
    success: bool
    data: Optional[PortfolioResponseData] = None

# 4. 레벨(Level) 관련 스키마
class UserLevelResponse(BaseModel):
    success: bool
    data: Optional[dict] = None