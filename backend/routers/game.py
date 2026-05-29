import json
import os
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from openai import OpenAI
from sqlalchemy.orm import Session

from db import models, schemas, crud
from db.models import INITIAL_CASH
from db.session import get_db
from dependencies import get_current_user
from utils.scoring import calculate_score

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

router = APIRouter()


def _calc_portfolio_value(
    prev_value: float,
    prev_allocations: dict | None,
    prices_map: dict,
    day_index: int,
) -> float:
    """
    오늘의 평가액 = 어제 평가액 × Σ(어제 비율 × 오늘가격/어제가격).
    Day1은 아직 운용 전이므로 INITIAL_CASH 그대로 반환.
    """
    if day_index <= 1 or not prev_allocations:
        return round(INITIAL_CASH, 2)

    factor = 0.0
    leftover_ratio = 100.0
    for asset, ratio in prev_allocations.items():
        if ratio <= 0:
            continue
        prices = prices_map.get(asset)
        if not prices or len(prices) < day_index:
            continue
        prev_price  = prices[day_index - 2]
        today_price = prices[day_index - 1]
        if not prev_price:
            continue
        factor += (ratio / 100) * (today_price / prev_price)
        leftover_ratio -= ratio
    # 미배분 비율은 현금으로 간주하여 수익률 변동 없이 유지
    factor += max(leftover_ratio, 0) / 100
    return round(prev_value * factor, 2)


# ── 게임 참여 관리 ─────────────────────────────────────────────────────────────

@router.get("/api/game/my-participation")
def get_my_participation(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_active_participation(db, current_user.id)
    if not p:
        return {"success": True, "data": None}
    return {"success": True, "data": {"participation_id": p.id, "scenario_id": p.scenario_id}}


@router.get("/api/game/scenarios")
def get_scenarios(db: Session = Depends(get_db)):
    scenarios = crud.get_all_scenarios(db)
    return {
        "success": True,
        "data": [
            {
                "id":           s.id,
                "stage":        s.season,
                "name":         s.name,
                "theme":        s.theme,
                "scenario_key": s.scenario_key,
                "assets":       s.assets,
            }
            for s in scenarios
        ],
    }


@router.get("/api/game/my-cleared-scenarios")
def get_my_cleared_scenarios(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """본인이 클리어(finalize)한 시나리오 리스트.

    `finalized_at`은 마지막 GameAllocation의 created_at으로 추정 (Day 7 매매 확정 시점).
    프론트에서 시나리오 잠금 해제 시점 계산에 사용.
    """
    participations = (
        db.query(models.GameParticipation)
        .filter(
            models.GameParticipation.user_id == current_user.id,
            models.GameParticipation.is_finalized == True,  # noqa: E712
        )
        .all()
    )

    result = []
    for p in participations:
        last_alloc = (
            db.query(models.GameAllocation)
            .filter(models.GameAllocation.participation_id == p.id)
            .order_by(models.GameAllocation.day_index.desc())
            .first()
        )
        finalized_at = last_alloc.created_at if last_alloc else p.created_at

        # 점수·랭킹 (없으면 None — 정산 전인 케이스 대비)
        game_result = crud.get_game_result(db, p.id)
        rank_info = crud.get_rank_for_participation(db, p.id) if game_result else None

        result.append({
            "scenario_id":        p.scenario_id,
            "participation_id":   p.id,
            "finalized_at":       finalized_at.isoformat() if finalized_at else None,
            "total_score":        game_result.total_score if game_result else None,
            "final_return":       game_result.final_return if game_result else None,
            "rank":               rank_info["rank"] if rank_info else None,
            "total_participants": rank_info["total"] if rank_info else None,
        })

    return {"success": True, "data": result}


@router.post("/api/game/start")
def start_game(
    req: schemas.GameStartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scenario = crud.get_scenario_by_id(db, req.scenario_id)
    if not scenario:
        return JSONResponse(status_code=404, content={"success": False, "message": "시나리오를 찾을 수 없습니다."})

    # 같은 시나리오에 이미 참여 중이면 기존 participation 반환 (멱등성 보장)
    existing = crud.get_active_participation(db, current_user.id)
    if existing and existing.scenario_id == req.scenario_id:
        return {
            "success": True,
            "data": {"participation_id": existing.id, "scenario_id": existing.scenario_id},
        }

    p = crud.create_participation(db, current_user.id, req.scenario_id)
    return {
        "success": True,
        "data": {"participation_id": p.id, "scenario_id": p.scenario_id},
    }


# ── 게임 현황 조회 ─────────────────────────────────────────────────────────────
@router.get("/api/game/participation/{participation_id}")
def get_participation(
    participation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})

    scenario  = p.scenario
    today_idx = p.day_index

    # 가격 데이터를 {자산명: [day1가격, ..., day7가격]} 형태로 재구성
    prices_rows = crud.get_prices_by_scenario(db, scenario.id)
    prices_map: dict[str, list] = {}
    for row in prices_rows:
        prices_map.setdefault(row.asset, [None] * 7)
        prices_map[row.asset][row.day_index - 1] = row.price

    # 오늘까지 공개된 매크로 지표만 반환 (미래 정보 차단)
    macros_rows = crud.get_macros_by_scenario(db, scenario.id)
    macros = [
        {"day_index": m.day_index, "cpi": m.cpi, "interest_rate": m.interest_rate,
         "fx_usdkrw": m.fx_usdkrw, "vix": m.vix}
        for m in macros_rows if m.day_index <= today_idx
    ]

    news_by_day = {}
    for day in range(1, today_idx + 1):
        news_rows = crud.get_news_by_scenario_and_day(db, scenario.id, day)
        news_by_day[day] = [
            {"slot": n.slot, "title": n.title, "description": n.description, "news_type": n.news_type, "hint": n.hint}
            for n in news_rows
        ]

    alloc_rows = crud.get_allocations_by_participation(db, participation_id)
    allocations = [
        {"day_index": a.day_index, "allocations": a.allocations,
         "portfolio_value": a.portfolio_value, "return_rate": a.return_rate,
         "tags": a.tags or [], "memo": a.memo or ""}
        for a in alloc_rows
    ]

    # 마지막 확정 배분 이후 오늘까지 누락된 날을 실시간으로 평가액 계산
    latest_alloc = alloc_rows[-1] if alloc_rows else None
    if latest_alloc:
        current_value = latest_alloc.portfolio_value
        for d in range(latest_alloc.day_index + 1, today_idx + 1):
            current_value = _calc_portfolio_value(
                current_value, latest_alloc.allocations, prices_map, d
            )
    else:
        current_value = INITIAL_CASH
    total_return = round((current_value - INITIAL_CASH) / INITIAL_CASH * 100, 2)

    return {
        "success": True,
        "data": {
            "participation_id": p.id,
            "scenario": {
                "id":         scenario.id,
                "stage":      scenario.season,
                "name":       scenario.name,
                "theme":      scenario.theme,
                "assets":     scenario.assets,
                "recap_text": scenario.recap_text,
                "key_lesson": scenario.key_lesson,
            },
            "today_index":   today_idx,
            "is_finalized":  p.is_finalized,
            "current_value": current_value,
            "total_return":  total_return,
            "prices":        prices_map,
            "macros":        macros,
            "news_by_day":   news_by_day,
            "allocations":   allocations,
        },
    }



# ── 배분 확정 (매매) ───────────────────────────────────────────────────────────
@router.post("/api/game/participation/{participation_id}/allocate")
def allocate_game(
    participation_id: int,
    req: schemas.GameAllocateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})
    if p.is_finalized:
        return JSONResponse(status_code=400, content={"success": False, "message": "이미 종료된 시뮬레이션입니다."})

    today_idx = p.day_index

    prices_rows = crud.get_prices_by_scenario(db, p.scenario_id)
    prices_map: dict[str, list] = {}
    for row in prices_rows:
        prices_map.setdefault(row.asset, [None] * 7)
        prices_map[row.asset][row.day_index - 1] = row.price

    # 오늘 배분 전 이전 확정 기록이 있으면 그 이후 누락 날짜를 소급 정산 후 오늘 평가액 산출
    ancestor_alloc = None
    if today_idx > 1:
        for d in range(today_idx - 1, 0, -1):
            a = crud.get_allocation_by_day(db, participation_id, d)
            if a:
                ancestor_alloc = a
                break

    if ancestor_alloc:
        running_value = ancestor_alloc.portfolio_value
        for d in range(ancestor_alloc.day_index + 1, today_idx):
            running_value = _calc_portfolio_value(
                running_value, ancestor_alloc.allocations, prices_map, d
            )
            gap_return_rate = round((running_value - INITIAL_CASH) / INITIAL_CASH * 100, 2)
            crud.create_allocation(
                db, participation_id, d, ancestor_alloc.allocations, running_value, gap_return_rate
            )
        portfolio_value = _calc_portfolio_value(
            running_value, ancestor_alloc.allocations, prices_map, today_idx
        )
    else:
        # Day1 최초 배분: 아직 가격 변동 없으므로 원금 그대로
        portfolio_value = INITIAL_CASH
    return_rate = round((portfolio_value - INITIAL_CASH) / INITIAL_CASH * 100, 2)

    alloc = crud.create_allocation(
        db, participation_id, today_idx, req.allocations, portfolio_value, return_rate,
        tags=req.tags, memo=req.memo,
    )

    is_last_day = today_idx >= 7

    exp_result = None
    if is_last_day:
        crud.finalize_participation(db, participation_id)
        try:
            scenario = crud.get_scenario_by_id(db, p.scenario_id)
            all_allocs = crud.get_allocations_by_participation(db, participation_id)
            scores = calculate_score(all_allocs, scenario)
            crud.save_game_result(db, participation_id, scores)

            # 시즌 종료 EXP 부여: 종합 점수 × 0.5 (예: 80점 → 40 EXP)
            total_score = scores.get("total_score") or 0
            exp_amount = int(total_score * 0.5)
            if exp_amount > 0:
                exp_result = crud.grant_exp(db, current_user.id, exp_amount)
        except Exception as e:
            print(f"🚨 [점수 산출/EXP 부여 오류] participation {participation_id}: {e}")

    return {
        "success": True,
        "data": {
            "day_index":       alloc.day_index,
            "portfolio_value": alloc.portfolio_value,
            "return_rate":     alloc.return_rate,
            "is_finalized":    is_last_day,
            "granted_exp":     exp_result["granted"]       if exp_result else 0,
            "new_level":       exp_result["level"]         if exp_result else None,
            "new_exp":         exp_result["exp"]           if exp_result else None,
            "leveled_up":      exp_result["leveled_up"]    if exp_result else False,
            "gained_levels":   exp_result["gained_levels"] if exp_result else 0,
        },
    }



# ── 다음 일차 진행 ─────────────────────────────────────────────────────────────
@router.post("/api/game/participation/{participation_id}/advance-day")
def advance_day(
    participation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})
    if p.is_finalized:
        return JSONResponse(status_code=400, content={"success": False, "message": "이미 종료된 시뮬레이션입니다."})

    # 오늘 배분 확정 여부 검증
    today_alloc = crud.get_allocation_by_day(db, participation_id, p.day_index)
    if not today_alloc:
        return JSONResponse(status_code=400, content={"success": False, "message": "오늘 매매를 먼저 확정해야 합니다."})
    if p.day_index >= 7:
        return JSONResponse(status_code=400, content={"success": False, "message": "마지막 날입니다. 결과 페이지로 이동하세요."})

    new_day = crud.advance_day(db, participation_id)
    return {"success": True, "data": {"day_index": new_day}}


# ── 게임 결과 / 리뷰 ───────────────────────────────────────────────────────────
@router.get("/api/game/participation/{participation_id}/score")
def get_game_score(
    participation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})

    result = crud.get_game_result(db, participation_id)
    if not result:
        return JSONResponse(status_code=404, content={"success": False, "message": "아직 점수가 산출되지 않았습니다."})

    rank_info = crud.get_rank_for_participation(db, participation_id)

    return {
        "success": True,
        "data": {
            "participation_id":        result.participation_id,
            "final_return":            result.final_return,
            "correct_strategy_return": result.correct_strategy_return,
            "return_score":            result.return_score,
            "scenario_score":          result.scenario_score,
            "diversity_score":         result.diversity_score,
            "stability_score":         result.stability_score,
            "total_score":             result.total_score,
            "rank":                    rank_info["rank"]       if rank_info else None,
            "total_participants":       rank_info["total"]      if rank_info else None,
            "percentile":              rank_info["percentile"] if rank_info else None,
        },
    }


@router.get("/api/game/participation/{participation_id}/review")
def get_game_review(
    participation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = crud.get_participation(db, participation_id)
    if not p or p.user_id != current_user.id:
        return JSONResponse(status_code=404, content={"success": False, "message": "참여 정보를 찾을 수 없습니다."})

    if not p.is_finalized:
        return JSONResponse(status_code=400, content={"success": False, "message": "아직 종료되지 않은 시뮬레이션입니다."})

    scenario   = p.scenario
    alloc_rows = crud.get_allocations_by_participation(db, participation_id)
    result     = crud.get_game_result(db, participation_id)

    alloc_summary = [
        {
            "day":         a.day_index,
            "allocations": a.allocations or {},
            "return_rate": round(a.return_rate, 2) if a.return_rate is not None else None,
            "tags":        a.tags or [],
            "memo":        a.memo or "",
        }
        for a in alloc_rows
    ]

    score_text = (
        f"수익률 점수 {result.return_score}/30, "
        f"시나리오 적응 {result.scenario_score}/30, "
        f"분산투자 {result.diversity_score}/20, "
        f"안정성 {result.stability_score}/20, "
        f"종합 {result.total_score}/100, "
        f"최종 수익률 {result.final_return}%"
    ) if result else "점수 데이터 없음"

    prompt = f"""당신은 투자 시뮬레이션 코치입니다. 아래 투자자의 7일 시뮬레이션 결과를 분석하여 구체적이고 실용적인 피드백을 제공하세요.

[주의] 응답에 금액(원 단위 숫자)을 절대 언급하지 마세요. 자산 비중(%)과 수익률(%)만 사용하세요.

[시나리오]
- 이름: {scenario.name} / 테마: {scenario.theme}
- 투자 가능 자산: {', '.join(scenario.assets or [])}
- 정답 자산(이번 시나리오에서 성과가 좋은 자산): {', '.join(getattr(scenario, 'correct_assets', None) or [])}
- 함정 자산(피해야 할 자산): {', '.join(getattr(scenario, 'trap_assets', None) or [])}

[7일 투자 내역]
- allocations: 각 자산 비중(%)
- return_rate: 해당 일 기준 누적 수익률(%)
- tags: 투자자가 직접 선택한 투자 판단 근거 태그 (예: #금리인하_지연, #실적호조 등)
- memo: 투자자가 직접 입력한 자유 메모 (투자 이유, 전략 등)
tags와 memo는 투자자의 당일 판단 근거입니다. 이를 반드시 피드백에 반영하세요.
{json.dumps(alloc_summary, ensure_ascii=False, indent=2)}

[최종 점수]
{score_text}

반드시 아래 JSON 형식으로만 응답해주세요. 각 항목은 2~3문장, 존댓말로 작성하세요:
{{
  "good_judgment": "잘한 판단을 구체적 자산명·일자·비중(%) 근거와 함께 설명 (금액 언급 금지)",
  "bad_judgment": "아쉬운 판단을 구체적 자산명·일자·비중(%) 근거와 함께 설명 (금액 언급 금지)",
  "overall_review": "전반적인 투자 스타일 평가와 다음 시즌을 위한 실질적 조언 (금액 언급 금지)"
}}"""

    # AI 리뷰는 생성 비용이 크므로 한 번 생성된 결과를 feedback_text에 캐싱
    if result and result.feedback_text:
        try:
            cached = json.loads(result.feedback_text)
            return {"success": True, "data": cached}
        except Exception:
            pass

    if not OPENAI_API_KEY:
        return JSONResponse(status_code=503, content={"success": False, "message": "OpenAI API 키가 설정되지 않았습니다."})

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        review = json.loads(response.choices[0].message.content)
        data = {
            "good_judgment":  review.get("good_judgment", ""),
            "bad_judgment":   review.get("bad_judgment", ""),
            "overall_review": review.get("overall_review", ""),
        }

        if result:
            result.feedback_text = json.dumps(data, ensure_ascii=False)
            db.commit()

        return {"success": True, "data": data}
    except Exception as e:
        print(f"🚨 [리뷰 생성 오류]: {e}")
        return JSONResponse(status_code=500, content={"success": False, "message": "AI 리뷰 생성에 실패했습니다."})
