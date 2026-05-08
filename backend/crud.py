from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import Optional
import models, schemas
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
import models

def get_user_by_kakao_id(db: Session, kakao_id: str):
    return db.query(models.User).filter(models.User.kakao_id == kakao_id).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, kakao_id: str, nickname: str, profile_image: str):
    db_user = models.User(
        kakao_id=kakao_id, 
        nickname=nickname, 
        profile_image=profile_image
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_all_market_indices(db: Session):
    return db.query(models.MarketIndex).all()
 
def upsert_market_index(db: Session, name: str, data: dict, updated_at):
    row = db.query(models.MarketIndex).filter(models.MarketIndex.name == name).first()
    if row:
        row.price        = data["price"]
        row.change_rate  = data["change_rate"]
        row.change_value = data["change_value"]
        row.source       = data["source"]
        row.updated_at   = updated_at
    else:
        row = models.MarketIndex(
            name         = name,
            price        = data["price"],
            change_rate  = data["change_rate"],
            change_value = data["change_value"],
            source       = data["source"],
            updated_at   = updated_at
        )
        db.add(row)
    db.commit()

# =====================================================================
# [포트폴리오] 조회 / 생성
# =====================================================================

def get_portfolio_by_user_id(db: Session, user_id: int):
    return db.query(models.Portfolio).filter(models.Portfolio.user_id == user_id).first()

def create_portfolio(db: Session, user_id: int, template_id: int,
                     profile_id: str, name: str, allocations: list[dict]):
    existing = get_portfolio_by_user_id(db, user_id)
    if existing:
        db.delete(existing)
        db.flush()

    portfolio = models.Portfolio(
        user_id     = user_id,
        template_id = template_id,
        profile_id  = profile_id,
        name        = name
    )
    db.add(portfolio)
    db.flush()

    for item in allocations:
        alloc = models.PortfolioAllocation(
            portfolio_id = portfolio.id,
            asset        = item["asset"],
            ratio        = item["ratio"],
        )
        db.add(alloc)

    db.commit()
    db.refresh(portfolio)
    return portfolio

def get_template_by_id(db: Session, template_id: int):
    return db.query(models.PortfolioTemplate).filter(
        models.PortfolioTemplate.id == template_id
    ).first()

def get_templates_by_risk_level(db: Session, risk_level: int):
    return db.query(models.PortfolioTemplate).filter(
        models.PortfolioTemplate.risk_level == risk_level
    ).all()

def get_user_level(db: Session, user_id: int):
    return db.query(models.UserLevel).filter(models.UserLevel.user_id == user_id).first()

def create_user_level(db: Session, user_id: int):
    """유저 레벨 최초 생성 (level=1, exp=0)"""
    user_level = models.UserLevel(user_id=user_id)
    db.add(user_level)
    db.commit()
    db.refresh(user_level)
    return user_level


# =====================================================================
# 뉴스 조회 / 생성 (1~3단계 파이프라인 처리용)
# =====================================================================
def get_news_by_link(db: Session, link: str):
    """[2단계 Deduplication] 링크 기반 중복 기사 검증"""
    return db.query(models.News).filter(models.News.link == link).first()

def get_all_news_titles(db: Session) -> list[tuple[int, str]]:
    """[3단계 Deduplication] 제목 유사도 비교를 위한 기존 (id, title) 목록 조회"""
    return [(row[0], row[1]) for row in db.query(models.News.id, models.News.title).all()]

def create_news(db: Session, news_data: dict):
    """신규 기사 적재 (전처리 완료본)"""
    news = models.News(**news_data)
    db.add(news)
    db.commit()
    db.refresh(news)
    return news

def get_latest_news(db: Session, limit: int = 50):
    """대시보드용 최신 뉴스 조회 (발행일 기준 최신순)"""
    return db.query(models.News).order_by(models.News.pub_date.desc()).limit(limit).all()

def get_view_counts_24h_map(db: Session, news_ids: list[int]) -> dict[int, int]:
    """주어진 뉴스 id 리스트에 대해 24시간 내 조회수를 dict로 반환"""
    if not news_ids:
        return {}
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = (
        db.query(
            models.NewsView.news_id,
            func.count(models.NewsView.id).label("cnt"),
        )
        .filter(models.NewsView.viewed_at >= cutoff)
        .filter(models.NewsView.news_id.in_(news_ids))
        .group_by(models.NewsView.news_id)
        .all()
    )
    return {nid: cnt for nid, cnt in rows}


# =====================================================================
# 뉴스 조회수 (24시간 롤링 인기뉴스용)
# =====================================================================
def log_news_view(db: Session, news_id: int):
    """뉴스 클릭 1회 = 1행 insert"""
    view = models.NewsView(news_id=news_id)
    db.add(view)
    db.commit()

def get_popular_news_24h(db: Session, limit: int = 5):
    """최근 24시간 내 클릭 수 기준 인기 뉴스 상위 N개"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    subq = (
        db.query(
            models.NewsView.news_id.label("news_id"),
            func.count(models.NewsView.id).label("cnt"),
        )
        .filter(models.NewsView.viewed_at >= cutoff)
        .group_by(models.NewsView.news_id)
        .subquery()
    )

    return (
        db.query(models.News, subq.c.cnt)
        .join(subq, models.News.id == subq.c.news_id)
        .order_by(subq.c.cnt.desc(), models.News.pub_date.desc())
        .limit(limit)
        .all()
    )

def cleanup_old_news_views(db: Session):
    """24시간 지난 조회 로그 삭제 (운영용)"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    db.query(models.NewsView).filter(models.NewsView.viewed_at < cutoff).delete()
    db.commit()


# =====================================================================
# 뉴스 삭제 (저장 후 3일이 지난 뉴스 데이터 삭제)
# =====================================================================
# =====================================================================
# 게임 시뮬레이터
# =====================================================================

def get_scenario_by_id(db: Session, scenario_id: int):
    return db.query(models.GameScenario).filter(models.GameScenario.id == scenario_id).first()

def get_all_scenarios(db: Session):
    return db.query(models.GameScenario).order_by(models.GameScenario.season).all()

def get_prices_by_scenario(db: Session, scenario_id: int):
    return db.query(models.GameDayPrice).filter(
        models.GameDayPrice.scenario_id == scenario_id
    ).order_by(models.GameDayPrice.day_index).all()

def get_macros_by_scenario(db: Session, scenario_id: int):
    return db.query(models.GameDayMacro).filter(
        models.GameDayMacro.scenario_id == scenario_id
    ).order_by(models.GameDayMacro.day_index).all()

def get_news_by_scenario_and_day(db: Session, scenario_id: int, day_index: int):
    return db.query(models.GameDayNews).filter(
        models.GameDayNews.scenario_id == scenario_id,
        models.GameDayNews.day_index == day_index,
    ).order_by(models.GameDayNews.slot).all()

def get_participation(db: Session, participation_id: int):
    return db.query(models.GameParticipation).filter(
        models.GameParticipation.id == participation_id
    ).first()

def get_active_participation(db: Session, user_id: int):
    """유저의 진행 중(미완료) participation 반환"""
    return db.query(models.GameParticipation).filter(
        models.GameParticipation.user_id == user_id,
        models.GameParticipation.is_finalized == False,
    ).order_by(models.GameParticipation.created_at.desc()).first()

def create_participation(db: Session, user_id: int, scenario_id: int, start_date, initial_cash: float = 10_000_000):
    p = models.GameParticipation(
        user_id      = user_id,
        scenario_id  = scenario_id,
        start_date   = start_date,
        initial_cash = initial_cash,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

def get_allocations_by_participation(db: Session, participation_id: int):
    return db.query(models.GameAllocation).filter(
        models.GameAllocation.participation_id == participation_id
    ).order_by(models.GameAllocation.day_index).all()

def get_allocation_by_day(db: Session, participation_id: int, day_index: int):
    return db.query(models.GameAllocation).filter(
        models.GameAllocation.participation_id == participation_id,
        models.GameAllocation.day_index == day_index,
    ).first()

def create_allocation(db: Session, participation_id: int, day_index: int,
                      allocations: dict, portfolio_value: float, return_rate: float,
                      tags: Optional[list] = None, memo: Optional[str] = None):
    alloc = models.GameAllocation(
        participation_id = participation_id,
        day_index        = day_index,
        allocations      = allocations,
        portfolio_value  = portfolio_value,
        return_rate      = return_rate,
        tags             = tags or [],
        memo             = memo or "",
    )
    db.add(alloc)
    db.commit()
    db.refresh(alloc)
    return alloc

def finalize_participation(db: Session, participation_id: int):
    p = get_participation(db, participation_id)
    if p:
        p.is_finalized = True
        db.commit()
    return p


def delete_old_news(db: Session, days_to_keep: int = 3) -> int:
    """
    저장된 지 특정 일수(days_to_keep)가 지난 과거 뉴스 데이터를 DB에서 삭제합니다.
    """
    # 현재 UTC 시간 기준으로 3일 전 날짜 계산
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_to_keep)
    
    # 3일보다 이전에 생성된(created_at < cutoff_date) 데이터 일괄 삭제
    deleted_count = db.query(models.News).filter(models.News.created_at < cutoff_date).delete(synchronize_session=False)
    db.commit()
    
    return deleted_count