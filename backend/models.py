from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    kakao_id = Column(String, unique=True, index=True)
    nickname = Column(String)
    profile_image = Column(String, nullable=True)

class MarketIndex(Base):
    __tablename__ = "market_indices"
 
    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, unique=True, index=True)  # "KOSPI", "SP500" 등
    price        = Column(Float, default=0)
    change_rate  = Column(Float, default=0)
    change_value = Column(Float, default=0)
    source       = Column(String, default="")               # "kis", "finnhub", "yfinance"
    updated_at   = Column(DateTime(timezone=True))