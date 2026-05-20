from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import Optional
import random
import models, schemas
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

def get_latest_news(db: Session, limit: int = 51):
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


def get_game_result(db: Session, participation_id: int):
    return db.query(models.GameResult).filter_by(participation_id=participation_id).first()


def save_game_result(db: Session, participation_id: int, scores: dict) -> models.GameResult:
    """점수 dict를 받아 GameResult를 생성하거나 업데이트한다."""
    result = get_game_result(db, participation_id)
    if result is None:
        result = models.GameResult(participation_id=participation_id)
        db.add(result)

    result.final_return            = scores.get("final_return")
    result.correct_strategy_return = scores.get("correct_strategy_return")
    result.return_score            = scores.get("return_score")
    result.scenario_score          = scores.get("scenario_score")
    result.diversity_score         = scores.get("diversity_score")
    result.stability_score         = scores.get("stability_score")
    result.total_score             = scores.get("total_score")
    db.commit()
    db.refresh(result)
    return result


def get_rank_for_participation(db: Session, participation_id: int) -> dict | None:
    """같은 시나리오 내 실시간 순위 계산 (저장 없이 조회 시점에 COUNT)"""
    result = get_game_result(db, participation_id)
    if not result or result.total_score is None:
        return None

    participation = get_participation(db, participation_id)
    if not participation:
        return None

    scenario_id = participation.scenario_id
    my_score = result.total_score

    higher_count = (
        db.query(models.GameResult)
        .join(models.GameParticipation, models.GameResult.participation_id == models.GameParticipation.id)
        .filter(
            models.GameParticipation.scenario_id == scenario_id,
            models.GameResult.total_score > my_score,
        )
        .count()
    )
    total_count = (
        db.query(models.GameResult)
        .join(models.GameParticipation, models.GameResult.participation_id == models.GameParticipation.id)
        .filter(
            models.GameParticipation.scenario_id == scenario_id,
            models.GameResult.total_score.isnot(None),
        )
        .count()
    )

    my_rank = higher_count + 1
    percentile = round(my_rank / total_count * 100) if total_count > 0 else 100

    return {"rank": my_rank, "total": total_count, "percentile": percentile}


# =====================================================================
# 경제 퀴즈
# =====================================================================


def select_weighted_questions(db: Session, user_id: int, n: int = 6) -> list[models.QuizQuestion]:
    """매일 n개 문제 선택: 새로운 문제 4개 + 틀린 문제(가중치 높은) 2개
    - 틀린 문제가 2개 미만이면 새로운 문제로 채움
    - 새로운 문제가 4개 미만이면 가중치 높은 문제로 채움
    """
    WRONG_COUNT = 2

    all_questions = db.query(models.QuizQuestion).all()
    if not all_questions:
        return []

    progress_map: dict[int, models.QuizUserProgress] = {
        p.question_id: p
        for p in db.query(models.QuizUserProgress)
        .filter(models.QuizUserProgress.user_id == user_id)
        .all()
    }

    # 새로운 문제: 한 번도 시도하지 않은 문제
    new_questions = [q for q in all_questions if q.id not in progress_map]
    # 틀린 문제: 시도 기록이 있고 weight > 3 (정답 weight는 3 이하)
    wrong_questions = [
        q for q in all_questions
        if q.id in progress_map and progress_map[q.id].weight > 3
    ]
    # weight 내림차순 정렬 (가중치 높은 = 가장 많이 틀린 문제 우선)
    wrong_questions.sort(key=lambda q: progress_map[q.id].weight, reverse=True)

    seen: set[int] = set()
    selected: list[models.QuizQuestion] = []

    def add_unique(questions: list, count: int, use_weight: bool = False):
        """questions 중 중복 없이 count개 추가. use_weight=True면 가중치 기반 랜덤."""
        candidates = [q for q in questions if q.id not in seen]
        if not candidates:
            return
        take = min(count, len(candidates))
        if use_weight:
            w = [progress_map[q.id].weight if q.id in progress_map else 10 for q in candidates]
            chosen = []
            pool, pool_w = list(candidates), list(w)
            for _ in range(take):
                if not pool:
                    break
                pick = random.choices(pool, weights=pool_w, k=1)[0]
                idx = pool.index(pick)
                chosen.append(pick)
                pool.pop(idx)
                pool_w.pop(idx)
        else:
            chosen = random.sample(candidates, take)
        for q in chosen:
            if q.id not in seen:
                seen.add(q.id)
                selected.append(q)

    # 1단계: 틀린 문제 최대 WRONG_COUNT개
    add_unique(wrong_questions, WRONG_COUNT)
    wrong_picked = len(selected)

    # 2단계: 새로운 문제로 나머지 채우기 (목표: NEW_COUNT + 부족한 틀린 문제 수)
    new_target = n - wrong_picked  # 보통 4, 틀린 문제 부족 시 그 이상
    add_unique(new_questions, new_target)

    # 3단계: 새로운 문제도 부족하면 가중치 높은 문제로 채우기
    if len(selected) < n:
        remaining_all = [q for q in all_questions if q.id not in seen]
        add_unique(remaining_all, n - len(selected), use_weight=True)

    return selected[:n]



def get_quiz_question_by_id(db: Session, question_id: int) -> models.QuizQuestion | None:
    return db.query(models.QuizQuestion).filter(models.QuizQuestion.id == question_id).first()


def get_quiz_progress(db: Session, user_id: int, question_id: int) -> models.QuizUserProgress | None:
    return (
        db.query(models.QuizUserProgress)
        .filter(
            models.QuizUserProgress.user_id == user_id,
            models.QuizUserProgress.question_id == question_id,
        )
        .first()
    )


def submit_quiz_answer(
    db: Session,
    user_id: int,
    question_id: int,
    selected_answer: str,
    is_correct: bool,
) -> dict:
    """답안 제출 → 가중치·streak 갱신 + QuizAttempt 저장 + 세션 is_solved 갱신"""
    now = datetime.now(timezone.utc)

    # 1) 진행 상태 upsert
    prog = get_quiz_progress(db, user_id, question_id)
    if prog is None:
        prog = models.QuizUserProgress(
            user_id=user_id,
            question_id=question_id,
            weight=10,
            correct_streak=0,
            total_attempts=0,
            total_correct=0,
            cycle=1,
        )
        db.add(prog)

    prog.total_attempts += 1
    if is_correct:
        prog.total_correct += 1
        prog.correct_streak += 1
        prog.weight = max(1, round(prog.weight * 0.5))
    else:
        prog.correct_streak = 0
        prog.weight = min(30, round(prog.weight * 1.5))

    prog.last_attempted_at = now
    db.flush()

    # 2) 시도 기록 저장
    attempt = models.QuizAttempt(
        user_id=user_id,
        question_id=question_id,
        selected_answer=selected_answer,
        is_correct=is_correct,
        cycle=prog.cycle,
    )
    db.add(attempt)

    db.commit()

    return {
        "is_correct": is_correct,
        "weight": prog.weight,
        "correct_streak": prog.correct_streak,
        "total_attempts": prog.total_attempts,
        "total_correct": prog.total_correct,
    }


def get_quiz_status(db: Session, user_id: int) -> dict:
    """전체 학습 통계"""
    total_questions = db.query(models.QuizQuestion).count()
    mastered = (
        db.query(models.QuizUserProgress)
        .filter(
            models.QuizUserProgress.user_id == user_id,
            models.QuizUserProgress.weight == 1,
        )
        .count()
    )
    attempted = (
        db.query(models.QuizUserProgress)
        .filter(models.QuizUserProgress.user_id == user_id)
        .count()
    )

    return {
        "total_questions": total_questions,
        "attempted": attempted,
        "mastered": mastered,
    }


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