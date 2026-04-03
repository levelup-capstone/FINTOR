from sqlalchemy.orm import Session
import models, schemas

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

def create_portfolio(db: Session, user_id: int, profile_id: str,
                     name: str, allocations: list[dict]):
    # 기존 포트폴리오가 있으면 삭제 후 재생성 (덮어쓰기)
    existing = get_portfolio_by_user_id(db, user_id)
    if existing:
        db.delete(existing)
        db.flush()

    portfolio = models.Portfolio(
        user_id    = user_id,
        profile_id = profile_id,
        name       = name
    )
    db.add(portfolio)
    db.flush()  # portfolio.id 확보

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

def get_user_level(db: Session, user_id: int):
    return db.query(models.UserLevel).filter(models.UserLevel.user_id == user_id).first()

def create_user_level(db: Session, user_id: int):
    """유저 레벨 최초 생성 (level=1, exp=0)"""
    user_level = models.UserLevel(user_id=user_id)
    db.add(user_level)
    db.commit()
    db.refresh(user_level)
    return user_level