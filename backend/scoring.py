"""
모의 투자 시뮬레이터 점수 산출 모듈

점수 구조 (총 100점):
  A. 수익률 점수         30점
  B. 시나리오 적응 점수  30점  (B1: 12 + B2: 10 + B3: 8)
  C. 분산투자 점수       20점
  D. 안정성 점수         20점  (D1: 12 + D2: 8)


"""

TOTAL_DAYS = 7


# ── 보조 함수 ──────────────────────────────────────────────────────────────

def get_effective_allocations(allocations: list[dict]) -> dict[int, dict]:
    """
    누락된 날을 선조 배분으로 채워 {day_index: alloc_dict} 반환.
    alloc_dict 구조: {day_index, allocations, portfolio_value, return_rate}
    """
    by_day = {a["day_index"]: a for a in allocations}
    result: dict[int, dict] = {}
    last: dict = {}
    last_pv: float | None = None
    last_rr: float | None = None

    for day in range(1, TOTAL_DAYS + 1):
        if day in by_day:
            entry = by_day[day]
            last    = entry.get("allocations") or {}
            last_pv = entry.get("portfolio_value")
            last_rr = entry.get("return_rate")
            result[day] = entry
        else:
            # 확정하지 않은 날은 선조 배분 그대로 유지
            result[day] = {
                "day_index":       day,
                "allocations":     last,
                "portfolio_value": last_pv,
                "return_rate":     last_rr,
            }
    return result


def _safe_asset_weight(alloc: dict, asset_list: list[str]) -> float:
    """자산 목록의 비중 합계 (0~100)."""
    return sum(alloc.get(a, 0) for a in asset_list)


# ── A. 수익률 점수 (30점) ──────────────────────────────────────────────────

def score_a_return(user_return: float, correct_return: float) -> float:
    """정답 전략 수익률 대비 사용자 수익률 차이로 점수 산출."""
    delta = user_return - correct_return
    if delta >= 1.0:    return 30.0
    if delta >= 0.0:    return 26.0
    if delta >= -2.0:   return 20.0
    if delta >= -4.0:   return 12.0
    return 5.0


# ── B. 시나리오 적응 점수 (30점) ──────────────────────────────────────────

def score_b1_correct_asset_holding(effective: dict[int, dict], correct_assets: list[str]) -> float:
    """B1: 정답 자산 평균 보유 비중 (12점)."""
    if not correct_assets:
        return 6.0  # 데이터 없을 때 기본값

    total_weight = 0.0
    for day in range(1, TOTAL_DAYS + 1):
        alloc = effective[day].get("allocations") or {}
        total_weight += _safe_asset_weight(alloc, correct_assets)

    avg_fraction = (total_weight / TOTAL_DAYS) / 100.0  # 0.0~1.0
    return round(avg_fraction * 12.0, 2)


def score_b2_key_event_response(effective: dict[int, dict], key_event_day: int, correct_assets: list[str]) -> float:
    """B2: 핵심 이벤트 다음 날 정답 자산 비중 증가 여부 (10점)."""
    next_day = key_event_day + 1
    if next_day > TOTAL_DAYS or not correct_assets:
        return 5.0  # 마지막 날 이벤트이거나 데이터 없으면 중간값

    alloc_event    = effective[key_event_day].get("allocations") or {}
    alloc_response = effective[next_day].get("allocations") or {}

    weight_before = _safe_asset_weight(alloc_event,    correct_assets)
    weight_after  = _safe_asset_weight(alloc_response, correct_assets)

    if weight_after > weight_before:    return 10.0
    if weight_after == weight_before:   return 5.0
    return 0.0


def score_b3_trap_avoidance(effective: dict[int, dict], trap_event_day: int, trap_assets: list[str]) -> float:
    """B3: 함정 구간에서 함정 자산 비중 미증가 여부 (8점)."""
    if not trap_assets or trap_event_day < 2:
        return 4.0  # 데이터 없으면 중간값

    alloc_before = effective[trap_event_day - 1].get("allocations") or {}
    alloc_trap   = effective[trap_event_day].get("allocations") or {}

    weight_before = _safe_asset_weight(alloc_before, trap_assets)
    weight_during = _safe_asset_weight(alloc_trap,   trap_assets)
    delta = weight_during - weight_before

    if delta < 0:    return 8.0   # 비중 감소
    if delta < 5.0:  return 4.0   # 소폭 증가 (5%p 미만)
    return 0.0                    # 대폭 증가


def score_b_adaptation(effective: dict[int, dict], scenario_meta: dict) -> float:
    """B: 시나리오 적응 점수 합산 (30점)."""
    correct_assets  = scenario_meta.get("correct_assets")  or []
    trap_assets     = scenario_meta.get("trap_assets")     or []
    key_event_day   = scenario_meta.get("key_event_day")   or 2
    trap_event_day  = scenario_meta.get("trap_event_day")  or 3

    b1 = score_b1_correct_asset_holding(effective, correct_assets)
    b2 = score_b2_key_event_response(effective, key_event_day, correct_assets)
    b3 = score_b3_trap_avoidance(effective, trap_event_day, trap_assets)
    return b1 + b2 + b3


# ── C. 분산투자 점수 (20점) ───────────────────────────────────────────────

def score_c_diversity(effective: dict[int, dict]) -> float:
    """C: 7일 평균 보유 자산 수 기준 점수 (20점)."""
    total_held = 0
    counted_days = 0
    for day in range(1, TOTAL_DAYS + 1):
        alloc = effective[day].get("allocations") or {}
        if alloc:
            total_held += sum(1 for v in alloc.values() if v > 0)
            counted_days += 1

    if counted_days == 0:
        return 0.0

    avg = total_held / counted_days
    if avg >= 4:    return 20.0
    if avg >= 3:    return 14.0
    if avg >= 2:    return 8.0
    return 0.0


# ── D. 안정성 점수 (20점) ─────────────────────────────────────────────────

def score_d1_volatility(effective: dict[int, dict]) -> float:
    """D1: 일일 포트폴리오 하락 변동률 평균 (12점)."""
    has_data = False
    daily_changes: list[float] = []
    for day in range(2, TOTAL_DAYS + 1):
        pv_today = effective[day].get("portfolio_value")
        pv_prev  = effective[day - 1].get("portfolio_value")
        if pv_today is not None and pv_prev is not None and pv_prev > 0:
            has_data = True
            change = (pv_today - pv_prev) / pv_prev * 100
            if change < 0:
                daily_changes.append(abs(change))

    if not has_data:
        return 6.0  # portfolio_value 데이터 자체가 없음
    if not daily_changes:
        return 12.0  # 데이터는 있으나 하락일 없음 = 완전 안정

    avg_vol = sum(daily_changes) / len(daily_changes)
    if avg_vol < 1.0:   return 12.0
    if avg_vol < 2.0:   return 8.0
    if avg_vol < 3.0:   return 4.0
    return 0.0


def score_d2_crash_defense(effective: dict[int, dict], crash_event_day: int) -> float:
    """D2: 급락 이벤트 당일 포트폴리오 하락률 (8점)."""
    if crash_event_day < 2:
        return 4.0

    pv_crash = effective[crash_event_day].get("portfolio_value")
    pv_prev  = effective[crash_event_day - 1].get("portfolio_value")

    if pv_crash is None or pv_prev is None or pv_prev == 0:
        return 4.0  # 데이터 없으면 중간값

    change_pct = (pv_crash - pv_prev) / pv_prev * 100
    if change_pct > -3.0:   return 8.0
    if change_pct > -6.0:   return 4.0
    return 0.0


def score_d_stability(effective: dict[int, dict], scenario_meta: dict) -> float:
    """D: 안정성 점수 합산 (20점)."""
    crash_event_day = scenario_meta.get("crash_event_day") or 5

    d1 = score_d1_volatility(effective)
    d2 = score_d2_crash_defense(effective, crash_event_day)
    return d1 + d2


# ── 메인 산출 함수 ─────────────────────────────────────────────────────────

def calculate_score(allocations: list, scenario) -> dict:
    """
    시즌 종료 시 전체 점수를 산출하여 dict로 반환.

    Args:
        allocations: GameAllocation ORM 객체 리스트 (day_index, allocations, portfolio_value, return_rate)
        scenario:    GameScenario ORM 객체

    Returns:
        {return_score, scenario_score, diversity_score, stability_score,
         total_score, final_return, correct_strategy_return}
    """
    # ORM → dict 변환
    alloc_dicts = []
    for a in allocations:
        if hasattr(a, "__dict__"):
            alloc_dicts.append({
                "day_index":       a.day_index,
                "allocations":     a.allocations or {},
                "portfolio_value": a.portfolio_value,
                "return_rate":     a.return_rate,
            })
        else:
            alloc_dicts.append(a)

    effective = get_effective_allocations(alloc_dicts)

    # 한 번도 배분하지 않은 경우: 시나리오 적응 점수 0점
    never_allocated = not any(
        bool(a.get("allocations")) for a in alloc_dicts
    )

    scenario_meta = {
        "correct_assets":          getattr(scenario, "correct_assets",          None) or [],
        "trap_assets":             getattr(scenario, "trap_assets",             None) or [],
        "correct_strategy_return": getattr(scenario, "correct_strategy_return", None) or 0.0,
        "key_event_day":           getattr(scenario, "key_event_day",           None) or 2,
        "trap_event_day":          getattr(scenario, "trap_event_day",          None) or 3,
        "crash_event_day":         getattr(scenario, "crash_event_day",         None) or 5,
    }

    # 사용자 최종 수익률: Day 7 기록 우선, 없으면 마지막 확인된 값
    user_return = 0.0
    for day in range(TOTAL_DAYS, 0, -1):
        rr = effective[day].get("return_rate")
        if rr is not None:
            user_return = rr
            break

    correct_return = scenario_meta["correct_strategy_return"]

    a_score = score_a_return(user_return, correct_return)
    b_score = 0.0 if never_allocated else score_b_adaptation(effective, scenario_meta)
    c_score = score_c_diversity(effective)
    d_score = score_d_stability(effective, scenario_meta)
    total   = round(a_score + b_score + c_score + d_score, 2)

    return {
        "return_score":            round(a_score, 2),
        "scenario_score":          round(b_score, 2),
        "diversity_score":         round(c_score, 2),
        "stability_score":         round(d_score, 2),
        "total_score":             total,
        "final_return":            round(user_return, 4),
        "correct_strategy_return": round(correct_return, 4),
    }
