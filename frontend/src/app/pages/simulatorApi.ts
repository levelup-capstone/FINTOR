const API_BASE = 'http://localhost:8000';

function authHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type DayNews = {
  slot: number;
  title: string;
  description: string;
  news_type: string;
};

export type DayMacro = {
  day_index: number;
  cpi: number;
  interest_rate: number;
  fx_usdkrw: number;
  vix: number;
};

export type DayAllocation = {
  day_index: number;
  allocations: Record<string, number>;
  portfolio_value: number | null;
  return_rate: number | null;
  tags: string[];
  memo: string;
};

export type ScenarioInfo = {
  id: number;
  stage: number;
  name: string;
  theme: string;
  assets: string[];
  recap_text: string | null;
};

export type ParticipationData = {
  participation_id: number;
  scenario: ScenarioInfo;
  today_index: number;
  is_finalized: boolean;
  initial_cash: number;
  current_value: number;
  total_return: number;
  prices: Record<string, number[]>;      // { asset: [D1..D7] }
  macros: DayMacro[];                    // D1~오늘
  news_by_day: Record<number, DayNews[]>; // { day: [...] }
  allocations: DayAllocation[];          // 과거 확정 내역
};

export async function fetchParticipation(participationId: number): Promise<ParticipationData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/game/participation/${participationId}`, {
      headers: authHeaders(),
    });
    const json = await res.json();
    if (json.success) return json.data as ParticipationData;
    return null;
  } catch {
    return null;
  }
}

export async function startGame(scenarioId: number): Promise<{ participation_id: number; scenario_id: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/game/start`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
    const json = await res.json();
    if (json.success) return json.data;
    return null;
  } catch {
    return null;
  }
}

export async function confirmAllocation(
  participationId: number,
  allocations: Record<string, number>,
  tags: string[],
  memo: string,
): Promise<{ day_index: number; portfolio_value: number; return_rate: number; is_finalized: boolean } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/game/participation/${participationId}/allocate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ allocations, tags, memo }),
    });
    const json = await res.json();
    if (json.success) return json.data;
    return null;
  } catch {
    return null;
  }
}

// [DEV ONLY] 시나리오 진행 전체 초기화 - 테스트 전용, 배포 전 제거 필요
export async function devResetParticipation(): Promise<{ deleted_count: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/game/dev/reset-all`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (json.success) return json.data;
    return null;
  } catch {
    return null;
  }
}

// [DEV ONLY] 다음 일차 강제 이동 - 테스트 전용, 배포 전 제거 필요
export async function devAdvanceDay(participationId: number): Promise<{ today_index: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/game/participation/${participationId}/dev/advance-day`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (json.success) return json.data;
    return null;
  } catch {
    return null;
  }
}

export async function fetchScenarios(): Promise<ScenarioInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/game/scenarios`, { headers: authHeaders() });
    const json = await res.json();
    if (json.success) return json.data;
    return [];
  } catch {
    return [];
  }
}
