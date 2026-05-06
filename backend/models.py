from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    kakao_id = Column(String, unique=True, index=True)
    nickname = Column(String)
    profile_image = Column(String, nullable=True)
    survey = relationship("Survey", back_populates="owner", uselist=False, cascade="all, delete-orphan")


class Survey(Base):
    __tablename__ = "surveys"

    id                    = Column(Integer, primary_key=True, index=True)
    user_id               = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    age_group             = Column(String, nullable=False)
    investment_experience = Column(String, nullable=False)
    preferred_period      = Column(String, nullable=False)
    preferred_assets      = Column(JSONB, nullable=False)
    risk_type             = Column(String, nullable=False)
    investment_assets     = Column(String, nullable=False)
    monthly_income        = Column(String, nullable=False)
    investment_goal       = Column(String, nullable=False)
    created_at            = Column(DateTime, default=datetime.utcnow)
    owner                 = relationship("User", back_populates="survey")

class MarketIndex(Base):
    __tablename__ = "market_indices"
 
    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, unique=True, index=True)  # "KOSPI", "SP500" 등
    price        = Column(Float, default=0)
    change_rate  = Column(Float, default=0)
    change_value = Column(Float, default=0)
    source       = Column(String, default="")               # "kis", "finnhub", "yfinance"
    updated_at   = Column(DateTime(timezone=True))

class PortfolioTemplate(Base):
    __tablename__ = "portfolio_templates"

    id          = Column(Integer, primary_key=True, index=True)
    risk_level  = Column(Integer, nullable=False, index=True)
    profile_id  = Column(String, nullable=False, unique=True)
    title       = Column(String, nullable=False)
    description = Column(String, nullable=True)
    tags        = Column(JSONB, nullable=False)       # ["etf", "bonds", ...]
    allocations = Column(JSONB, nullable=False)       # [{"asset": "etf", "label": "ETF", "ratio": 30}, ...]
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    portfolios  = relationship("Portfolio", back_populates="template",
                               passive_deletes=True)


class Portfolio(Base):
    __tablename__ = "portfolios"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    template_id = Column(Integer, ForeignKey("portfolio_templates.id", ondelete="SET NULL"), nullable=True)
    profile_id  = Column(String, nullable=False)
    name        = Column(String, nullable=False)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                         onupdate=lambda: datetime.now(timezone.utc))

    allocations = relationship("PortfolioAllocation", back_populates="portfolio",
                               cascade="all, delete-orphan")
    template    = relationship("PortfolioTemplate", back_populates="portfolios")


class PortfolioAllocation(Base):
    __tablename__ = "portfolio_allocations"

    id           = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    asset        = Column(String, nullable=False)
    ratio        = Column(Integer, nullable=False)

    portfolio = relationship("Portfolio", back_populates="allocations")

class UserLevel(Base):
    __tablename__ = "user_levels"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    level      = Column(Integer, default=1, nullable=False)
    exp        = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


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
    pub_date    = Column(String, nullable=False)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class NewsView(Base):
    __tablename__ = "news_views"

    id        = Column(Integer, primary_key=True, index=True)
    news_id   = Column(Integer, ForeignKey("news.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    viewed_at = Column(DateTime(timezone=True),
                       default=lambda: datetime.now(timezone.utc),
                       index=True)


# ──────────────────────────────────────────────
# 모의 투자 시뮬레이터
# ──────────────────────────────────────────────

class GameScenario(Base):
    """난이도별 시나리오 템플릿. 유저가 버튼을 눌러 시작하면 GameParticipation 생성."""
    __tablename__ = "game_scenarios"

    id           = Column(Integer, primary_key=True, index=True)
    stage        = Column(Integer, nullable=False, index=True)   # 1~5
    name         = Column(String, nullable=False)                # "시즌 #1"
    theme        = Column(String, nullable=False)                # "고금리 장기화"
    scenario_key = Column(String, nullable=False, unique=True)
    assets       = Column(JSONB, nullable=False)                 # ["cash","bonds",...]
    recap_text   = Column(String, nullable=True)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

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
    start_date   = Column(DateTime(timezone=True), nullable=False)   # 유저가 버튼 누른 시각
    initial_cash = Column(Float, default=10_000_000, nullable=False)
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
    created_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    participation = relationship("GameParticipation", back_populates="allocations")


class GameResult(Base):
    __tablename__ = "game_results"

    id               = Column(Integer, primary_key=True, index=True)
    participation_id = Column(Integer, ForeignKey("game_participations.id", ondelete="CASCADE"), nullable=False, unique=True)
    final_return     = Column(Float, nullable=True)
    return_score     = Column(Float, nullable=True)
    diversity_score  = Column(Float, nullable=True)
    stability_score  = Column(Float, nullable=True)
    scenario_score   = Column(Float, nullable=True)
    total_score      = Column(Float, nullable=True)
    rank             = Column(Integer, nullable=True)
    feedback_text    = Column(String, nullable=True)
    created_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    participation = relationship("GameParticipation", back_populates="result")