from pydantic import BaseModel
from typing import Optional, List



# ── 인증 ─────────────────────────────────────────────────────────────────────
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
    dashboardTourDone: bool
    simulatorTourDone: bool

class LoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[LoginData] = None



# ── 투자 성향 설문 ────────────────────────────────────────────────────────────
class SurveyCreate(BaseModel):
    age_group: str
    investment_experience: str
    preferred_period: str
    preferred_assets: List[str]
    risk_type: str
    investment_assets: str
    monthly_income: str
    investment_goal: str

class SurveyResponseData(BaseModel):
    risk_level: int
    risk_label: str

class SurveyResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[SurveyResponseData] = None



# ── 유저 레벨 ────────────────────────────────────────────────────────────────
class UserLevelResponse(BaseModel):
    success: bool
    data: Optional[dict] = None



# ── 모의 투자 시뮬레이터 ──────────────────────────────────────────────────────
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



# ── 퀴즈 ─────────────────────────────────────────────────────────────────────
class QuizQuestionItem(BaseModel):
    id:          int
    category:    str
    quiz_type:   str
    question:    str
    options:     List[str]

class QuizSubmitRequest(BaseModel):
    selected_answer: str

class QuizSubmitResult(BaseModel):
    is_correct:     bool
    correct_answer: str
    explanation:    str
    weight:         int
    correct_streak: int

class QuizInfiniteScoreRequest(BaseModel):
    score: int

class QuizDailyCompleteRequest(BaseModel):
    correct_count: int
    total: int
    streak: int
    results: List[bool]

class NicknameUpdateRequest(BaseModel):
    nickname: str

