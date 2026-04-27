from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
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