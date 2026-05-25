import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# ── DB 연결 설정 ──────────────────────────────────────────────────────────────
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"sslmode": "require"},  # Supabase(PostgreSQL) SSL 필수
    pool_pre_ping=True,                   # 연결 유효성 자동 검사 (끊긴 커넥션 재시도)
)


# ── 세션 팩토리 ───────────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# models.py의 모든 테이블이 상속하는 베이스 클래스
Base = declarative_base()


# ── FastAPI 의존성 ────────────────────────────────────────────────────────────
def get_db():
    """요청마다 DB 세션을 열고, 완료 후 반드시 닫는 제너레이터 의존성."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()