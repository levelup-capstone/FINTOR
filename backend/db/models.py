from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Date, ForeignKey, Boolean, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from db.session import Base

INITIAL_CASH: float = 10_000_000

# ── 사용자 ───────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    kakao_id = Column(String, unique=True, index=True)
    nickname = Column(String)
    profile_image = Column(String, nullable=True)
    dashboard_tour_done = Column(Boolean, default=False, nullable=False)
    simulator_tour_done = Column(Boolean, default=False, nullable=False)
    survey = relationship("Survey", back_populates="owner", uselist=False, cascade="all, delete-orphan")


# ── 투자 성향 설문 ────────────────────────────────────────────────────────────
class Survey(Base):
    __tablename__ = "surveys"

    id                    = Column(Integer, primary_key=True, index=True)
    user_id               = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    age_group             = Column(String, nullable=False)
    investment_experience = Column(String, nullable=False)
    preferred_period      = Column(String, nullable=False)
    preferred_assets      = Column(JSONB, nullable=False)
    risk_type             = Column(String, nullable=False)
    risk_level            = Column(Integer, nullable=True)
    investment_assets     = Column(String, nullable=False)
    monthly_income        = Column(String, nullable=False)
    investment_goal       = Column(String, nullable=False)
    created_at            = Column(DateTime, default=datetime.utcnow)
    owner                 = relationship("User", back_populates="survey")

# ── 시장 지수 ────────────────────────────────────────────────────────────────
class MarketIndex(Base):
    __tablename__ = "market_indices"
 
    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, unique=True, index=True)  # "KOSPI", "SP500" 등
    price        = Column(Float, default=0)
    change_rate  = Column(Float, default=0)
    change_value = Column(Float, default=0)
    source       = Column(String, default="")               # "kis", "finnhub", "yfinance"
    updated_at   = Column(DateTime(timezone=True))

# ── 유저 레벨 ────────────────────────────────────────────────────────────────
class UserLevel(Base):
    __tablename__ = "user_levels"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    level      = Column(Integer, default=1, nullable=False)
    exp        = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


# ── 뉴스 ─────────────────────────────────────────────────────────────────────
class News(Base):
    __tablename__ = "news"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    description = Column(String, nullable=False)
    category    = Column(String, nullable=False, default="분석대기")
    sentiment   = Column(String, nullable=False, default="분석대기")
    tag         = Column(String, nullable=False, default="기타")
    reason      = Column(String, nullable=False, default="OpenAI 연동 대기중")
    link        = Column(String, unique=True, index=True, nullable=False)
    pub_date    = Column(DateTime(timezone=True), nullable=False)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class NewsView(Base):
    __tablename__ = "news_views"

    id        = Column(Integer, primary_key=True, index=True)
    news_id   = Column(Integer, ForeignKey("news.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    viewed_at = Column(DateTime(timezone=True),
                       default=lambda: datetime.now(timezone.utc),
                       index=True)


# ── 모의 투자 시뮬레이터 ──────────────────────────────────────────────────────

class GameScenario(Base):
    """난이도별 시나리오 템플릿. 유저가 버튼을 눌러 시작하면 GameParticipation 생성."""
    __tablename__ = "game_scenarios"

    id           = Column(Integer, primary_key=True, index=True)
    season       = Column(Integer, nullable=False, index=True)   # 1~5
    name         = Column(String, nullable=False)                # "시즌 #1"
    theme        = Column(String, nullable=False)                # "고금리 장기화"
    scenario_key = Column(String, nullable=False, unique=True)
    assets       = Column(JSONB, nullable=False)                 # ["cash","bonds",...]
    key_lesson              = Column(String,  nullable=True)
    recap_text              = Column(String,  nullable=True)
    # 점수 산출용 메타데이터
    correct_assets          = Column(JSONB,   nullable=True)  # ["bonds", "gold"]
    trap_assets             = Column(JSONB,   nullable=True)  # ["growth-stock", "coin"]
    correct_strategy_return = Column(Float,   nullable=True)  # 정답 전략 수익률 (%)
    key_event_day           = Column(Integer, nullable=True)  # 핵심 이벤트 발생 일자
    trap_event_day          = Column(Integer, nullable=True)  # 함정 이벤트 발생 일자
    crash_event_day         = Column(Integer, nullable=True)  # 급락 이벤트 발생 일자
    created_at              = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    prices         = relationship("GameDayPrice",      back_populates="scenario", cascade="all, delete-orphan")
    news           = relationship("GameDayNews",       back_populates="scenario", cascade="all, delete-orphan")
    macros         = relationship("GameDayMacro",      back_populates="scenario", cascade="all, delete-orphan")
    participations = relationship("GameParticipation", back_populates="scenario", cascade="all, delete-orphan")


class GameDayPrice(Base):
    __tablename__ = "game_day_prices"

    id          = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("game_scenarios.id", ondelete="CASCADE"), nullable=False, index=True)
    day_index   = Column(Integer, nullable=False)   # 1~7
    asset       = Column(String, nullable=False)
    price       = Column(Float, nullable=False)     # 시작 100 기준

    scenario = relationship("GameScenario", back_populates="prices")


class GameDayNews(Base):
    __tablename__ = "game_day_news"

    id          = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("game_scenarios.id", ondelete="CASCADE"), nullable=False, index=True)
    day_index   = Column(Integer, nullable=False)   # 1~7
    slot        = Column(Integer, nullable=False)   # 1~5
    title       = Column(String, nullable=False)
    description = Column(String, nullable=False)
    hint        = Column(String, nullable=True)     # 👉 로 시작하는 학습 힌트 (1단계 전체, 2단계 절반만)
    news_type   = Column(String, nullable=False)    # macro / bullish / bearish / trap / noise

    scenario = relationship("GameScenario", back_populates="news")


class GameDayMacro(Base):
    __tablename__ = "game_day_macros"

    id            = Column(Integer, primary_key=True, index=True)
    scenario_id   = Column(Integer, ForeignKey("game_scenarios.id", ondelete="CASCADE"), nullable=False, index=True)
    day_index     = Column(Integer, nullable=False)
    cpi           = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)
    fx_usdkrw     = Column(Float, nullable=False)
    vix           = Column(Float, nullable=False)

    scenario = relationship("GameScenario", back_populates="macros")


class GameParticipation(Base):
    __tablename__ = "game_participations"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scenario_id  = Column(Integer, ForeignKey("game_scenarios.id", ondelete="CASCADE"), nullable=False)
    day_index    = Column(Integer, default=1, nullable=False)        # 현재 게임 일차 (1~7)
    is_finalized = Column(Boolean, default=False, nullable=False)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    allocations = relationship("GameAllocation", back_populates="participation", cascade="all, delete-orphan")
    result      = relationship("GameResult",     back_populates="participation", uselist=False, cascade="all, delete-orphan")
    scenario    = relationship("GameScenario",   back_populates="participations")


class GameAllocation(Base):
    __tablename__ = "game_allocations"

    id               = Column(Integer, primary_key=True, index=True)
    participation_id = Column(Integer, ForeignKey("game_participations.id", ondelete="CASCADE"), nullable=False, index=True)
    day_index        = Column(Integer, nullable=False)
    allocations      = Column(JSONB, nullable=False)   # {"cash": 20, "bonds": 40, ...}
    portfolio_value  = Column(Float, nullable=True)
    return_rate      = Column(Float, nullable=True)
    tags             = Column(JSONB, nullable=True)    # ["#태그1", "#태그2", ...]
    memo             = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    participation = relationship("GameParticipation", back_populates="allocations")


class GameResult(Base):
    __tablename__ = "game_results"

    id                      = Column(Integer, primary_key=True, index=True)
    participation_id        = Column(Integer, ForeignKey("game_participations.id", ondelete="CASCADE"), nullable=False, unique=True)
    final_return            = Column(Float,   nullable=True)
    correct_strategy_return = Column(Float,   nullable=True)
    return_score            = Column(Float,   nullable=True)
    scenario_score          = Column(Float,   nullable=True)
    diversity_score         = Column(Float,   nullable=True)
    stability_score         = Column(Float,   nullable=True)
    total_score             = Column(Float,   nullable=True)
    rank                    = Column(Integer, nullable=True)
    feedback_text           = Column(String,  nullable=True)
    created_at              = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    participation = relationship("GameParticipation", back_populates="result")


# ── 경제 퀴즈 ────────────────────────────────────────────────────────────────

class QuizQuestion(Base):
    """퀴즈 문제 저장 (150문제 시드)"""
    __tablename__ = "quiz_questions"

    id          = Column(Integer, primary_key=True, index=True)
    category    = Column(String, nullable=False, index=True)
    quiz_type   = Column(String, nullable=False)               # "ox" / "multiple"
    question    = Column(Text, nullable=False)
    options     = Column(JSONB, nullable=False)                # ["O","X"] or ["①..","②..","③..","④.."]
    answer      = Column(String, nullable=False)
    explanation = Column(Text, nullable=False)
    hint        = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    progress = relationship("QuizUserProgress", back_populates="question", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt",       back_populates="question", cascade="all, delete-orphan")


class QuizUserProgress(Base):
    """유저별 문제 학습 상태 (가중치, 연속 정답 등)"""
    __tablename__ = "quiz_user_progress"
    __table_args__ = (UniqueConstraint("user_id", "question_id", name="uq_quiz_progress_user_question"),)

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id       = Column(Integer, ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    weight            = Column(Integer, default=10, nullable=False)   # 1~30: 높을수록 출제 빈도 증가 (정답 시 *0.5, 오답 시 *1.5)
    correct_streak    = Column(Integer, default=0,  nullable=False)   # 연속 정답 횟수
    total_attempts    = Column(Integer, default=0,  nullable=False)
    total_correct     = Column(Integer, default=0,  nullable=False)
    cycle             = Column(Integer, default=1,  nullable=False)   # 현재 사이클
    last_attempted_at = Column(DateTime(timezone=True), nullable=True)

    user     = relationship("User")
    question = relationship("QuizQuestion", back_populates="progress")


class QuizAttempt(Base):
    """퀴즈 풀이 이력"""
    __tablename__ = "quiz_attempts"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id     = Column(Integer, ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    selected_answer = Column(String, nullable=False)
    is_correct      = Column(Boolean, nullable=False)
    cycle           = Column(Integer, nullable=False, default=1)
    attempted_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user     = relationship("User")
    question = relationship("QuizQuestion", back_populates="attempts")


class QuizSeason(Base):
    """무한 퀴즈 시즌 메타 (기간·EXP 지급 여부 관리)"""
    __tablename__ = "quiz_seasons"

    season          = Column(Integer, primary_key=True)
    start_at        = Column(DateTime(timezone=True), nullable=False)
    end_at          = Column(DateTime(timezone=True), nullable=False)
    # 시즌 종료 후 랭킹 기반 EXP가 지급되면 True로 전환 (중복 지급 방지)
    exp_distributed = Column(Boolean, default=False, nullable=False)


class QuizSeasonScore(Base):
    """무한 퀴즈 시즌별 최고 기록"""
    __tablename__ = "quiz_season_scores"
    __table_args__ = (UniqueConstraint("user_id", "season", name="uq_quiz_season_user"),)

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    season     = Column(Integer, nullable=False, default=1)
    best_score = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")


class QuizDailyCompletion(Base):
    """일일 퀴즈 완료 기록 (날짜별 1행)"""
    __tablename__ = "quiz_daily_completions"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_quiz_daily_user_date"),)

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date          = Column(Date, nullable=False)                # KST 날짜 (YYYY-MM-DD)
    correct_count = Column(Integer, nullable=False)
    total         = Column(Integer, nullable=False)
    streak        = Column(Integer, nullable=False, default=0)
    results       = Column(JSONB, nullable=False)               # [true, false, ...]
    completed_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


