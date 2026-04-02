from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
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

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    age_group = Column(String, nullable=False)
    investment_experience = Column(String, nullable=False)
    preferred_period = Column(String, nullable=False)
    preferred_assets = Column(JSONB, nullable=False) 
    risk_type = Column(String, nullable=False)
    investment_assets = Column(String, nullable=False)
    monthly_income = Column(String, nullable=False)
    investment_goal = Column(String, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="survey")