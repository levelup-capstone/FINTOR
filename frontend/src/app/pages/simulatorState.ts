import type { ParticipationData, ScenarioInfo, ClearedScenario } from './simulatorApi';

/** KST 자정 기준으로 from 시각의 "다음 날 00:00 KST"를 반환 */
export function nextKstMidnight(from: Date): Date {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(from.getTime() + kstOffsetMs);
  const kstNextDay = new Date(Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return new Date(kstNextDay.getTime() - kstOffsetMs);
}

export type ScenarioStatus = 'cleared' | 'active' | 'finalized' | 'available' | 'locked';
export type ScenarioState = {
  scenario: ScenarioInfo;
  status: ScenarioStatus;
  unlockAt?: Date;
  cleared?: ClearedScenario;   // cleared/finalized 시즌의 점수·랭킹
};

/**
 * 각 시즌의 잠금/진행/완료 상태 계산.
 * - finalized: 활성 participation이면서 is_finalized=true (현재 보이는 시즌)
 * - active: 활성 participation이면서 진행 중
 * - cleared: 본인이 이미 클리어 (활성 시즌은 아님)
 * - available: 시작 가능
 * - locked: 이전 시즌 미클리어 또는 KST 자정 대기
 */
export function determineStates(
  scenarios: ScenarioInfo[],
  activeData: ParticipationData | null,
  cleared: ClearedScenario[],
): ScenarioState[] {
  const sorted = [...scenarios].sort((a, b) => a.stage - b.stage);
  const now = Date.now();
  const clearedMap = new Map(cleared.map((c) => [c.scenario_id, c]));
  const activeId = activeData?.scenario.id ?? null;

  return sorted.map((scenario): ScenarioState => {
    if (activeId === scenario.id) {
      return {
        scenario,
        status: activeData?.is_finalized ? 'finalized' : 'active',
        cleared: clearedMap.get(scenario.id),
      };
    }
    if (clearedMap.has(scenario.id)) {
      return { scenario, status: 'cleared', cleared: clearedMap.get(scenario.id) };
    }
    if (scenario.stage === 1) return { scenario, status: 'available' };

    const prev = sorted.find((s) => s.stage === scenario.stage - 1);
    if (!prev) return { scenario, status: 'locked' };
    const prevCleared = clearedMap.get(prev.id);
    if (!prevCleared || !prevCleared.finalized_at) return { scenario, status: 'locked' };

    const unlockAt = nextKstMidnight(new Date(prevCleared.finalized_at));
    if (now >= unlockAt.getTime()) return { scenario, status: 'available' };
    return { scenario, status: 'locked', unlockAt };
  });
}
