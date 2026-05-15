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

class RecommendedPortfolio(BaseModel):
    template_id: int
    title: str
    description: Optional[str] = None
    allocations: List[AllocationItem]

class SurveyResponseData(BaseModel):
    risk_level: int
    risk_label: str

class SurveyResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[SurveyResponseData] = None

# 3. 포트폴리오(Portfolio) 관련 스키마
class PortfolioCreate(BaseModel):
    userid: int
    template_id: int

class PortfolioDetail(BaseModel):
    template_id: Optional[int] = None
    risk_level: Optional[int] = None
    risk_label: Optional[str] = None
    title: Optional[str] = None
    allocations: List[AllocationItem]
    d_day: int

class PortfolioResponseData(BaseModel):
    portfolio: PortfolioDetail

class PortfolioResponse(BaseModel):
    success: bool
    data: Optional[PortfolioResponseData] = None

# 4. 레벨(Level) 관련 스키마
class UserLevelResponse(BaseModel):
    success: bool
    data: Optional[dict] = None

# 5. 게임 시뮬레이터 관련 스키마
class GameStartRequest(BaseModel):
    scenario_id: int

class GameAllocateRequest(BaseModel):
    allocations: dict        # {"bonds": 40, "gold": 20, ...}
    tags: List[str] = []    # ["#태그1", "#태그2", ...]
    memo: str = ""

class DayPriceItem(BaseModel):
    asset: str
    prices: List[float]  # D1~D7 (미래는 null 대신 리스트 길이로 구분)

class DayMacroItem(BaseModel):
    day_index: int
    cpi: float
    interest_rate: float
    fx_usdkrw: float
    vix: float

class DayNewsItem(BaseModel):
    slot: int
    title: str
    description: str
    news_type: str  # macro / bullish / bearish / trap / noise

class DayAllocationItem(BaseModel):
    day_index: int
    allocations: dict
    portfolio_value: Optional[float] = None
    return_rate: Optional[float] = None

class GameParticipationResponse(BaseModel):
    success: bool
    data: Optional[dict] = None


class GameScoreData(BaseModel):
    participation_id:        int
    final_return:            Optional[float] = None
    correct_strategy_return: Optional[float] = None
    return_score:            Optional[float] = None
    scenario_score:          Optional[float] = None
    diversity_score:         Optional[float] = None
    stability_score:         Optional[float] = None
    total_score:             Optional[float] = None


class GameScoreResponse(BaseModel):
    success: bool
    data:    Optional[GameScoreData] = None