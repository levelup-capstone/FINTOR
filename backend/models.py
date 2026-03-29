from sqlalchemy import Column, Integer, String, Date, ForeignKey, UniqueConstraint
from database import Base
from datetime import date

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    kakao_id = Column(String, unique=True, index=True)
    nickname = Column(String)
    profile_image = Column(String, nullable=True)

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, default=date.today)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="unique_user_date"),
    )