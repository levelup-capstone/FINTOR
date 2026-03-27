from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models, schemas, crud
from database import engine, get_db

# DB 테이블 자동 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# 프론트엔드(React) 접근 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 기본 통신 확인용 주소
@app.get("/")
def read_root():
    return {"message": "FastAPI 서버가 정상적으로 실행 중입니다!"}

# DB 데이터 추가 주소
@app.post("/items/", response_model=schemas.ItemResponse)
def create_item(item: schemas.ItemCreate, db: Session = Depends(get_db)):
    return crud.create_item(db=db, item=item)

# DB 데이터 조회 주소
@app.get("/items/", response_model=list[schemas.ItemResponse])
def read_items(db: Session = Depends(get_db)):
    return crud.get_items(db)