from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from db import crud, models
from db.session import get_db

router = APIRouter()


@router.get("/api/v1/market/indices")
def get_market_indices(db: Session = Depends(get_db)):
    rows = crud.get_all_market_indices(db)

    if not rows:
        raise HTTPException(status_code=503, detail="시장 데이터 준비 중입니다. 잠시 후 다시 시도해주세요.")

    data = {}
    latest_updated_at = None

    for row in rows:
        data[row.name] = {
            "price":        row.price,
            "change_rate":  row.change_rate,
            "change_value": row.change_value,
            "source":       row.source,
        }
        if latest_updated_at is None or row.updated_at > latest_updated_at:
            latest_updated_at = row.updated_at

    return {
        "success": True,
        "message": "시장 지표 데이터 조회 완료",
        "data": data,
        "updated_at": latest_updated_at.isoformat() if latest_updated_at else None,
    }


@router.get("/api/v1/market/news")
def get_market_news(db: Session = Depends(get_db)):
    news_list = crud.get_latest_news(db)
    view_map = crud.get_view_counts_24h_map(db, [n.id for n in news_list])
    return {
        "success": True,
        "data": [
            {
                "id":          n.id,
                "title":       n.title,
                "description": n.description,
                "category":    n.category,
                "sentiment":   n.sentiment,
                "reason":      n.reason,
                "tag":         n.tag,
                "link":        n.link,
                "pub_date":    n.pub_date,
                "created_at":  n.created_at.isoformat() if n.created_at else None,
                "view_count":  view_map.get(n.id, 0),
            }
            for n in news_list
        ],
    }


@router.get("/api/v1/market/news/popular")
def get_popular_news(db: Session = Depends(get_db)):
    rows = crud.get_popular_news_24h(db, limit=5)
    return {
        "success": True,
        "data": [
            {
                "id":          n.id,
                "title":       n.title,
                "description": n.description,
                "category":    n.category,
                "sentiment":   n.sentiment,
                "reason":      n.reason,
                "link":        n.link,
                "pub_date":    n.pub_date,
                "view_count":  cnt,
            }
            for n, cnt in rows
        ],
    }


@router.post("/api/v1/market/news/{news_id}/view")
def add_news_view(news_id: int, db: Session = Depends(get_db)):
    news = db.query(models.News).filter(models.News.id == news_id).first()
    if not news:
        return JSONResponse(status_code=404, content={"success": False, "message": "뉴스를 찾을 수 없습니다."})
    crud.log_news_view(db, news_id)
    return {"success": True}
