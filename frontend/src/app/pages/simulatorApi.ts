const API_BASE = '';

function authHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// 401: 토큰 만료 또는 미인증 → 세션 정리 후 로그인 페이지로 강제 이동
function expireSession() {
  localStorage.clear();
  window.location.href = '/';
}

async function apiCall<T>(path: string, init: RequestInit = {}, fallback: T | null = null): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
    });
    if (res.status === 401) {
      expireSession();
      return fallback;
    }
    const json = await res.json();
    if (json.success) return json.data as T;
    return fallback;
  } catch {
    return fallback;
  }
}

export type DayNews = {
  slot: number;
  title: string;
  description: string;
  news_type: string;
  hint: string | null;
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
  key_lesson: string | null;
};

export type ParticipationData = {
  participation_id: number;
  scenario: ScenarioInfo;
  today_index: number;
  is_finalized: boolean;
  initial_cash: number;
  current_value: number;
  total_return: number;
  prices: Record<string, number[]>;       // { asset: [D1..D7] }
  macros: DayMacro[];                     // D1~오늘
  news_by_day: Record<number, DayNews[]>; // { day: [...] }
  allocations: DayAllocation[];           // 과거 확정 내역
};

export async function fetchParticipation(participationId: number): Promise<ParticipationData | null> {
  return apiCall<ParticipationData>(`/api/game/participation/${participationId}`);
}

export async function fetchMyParticipation(): Promise<{ participation_id: number; scenario_id: number } | null> {
  return apiCall<{ participation_id: number; scenario_id: number }>('/api/game/my-participation');
}

export async function startGame(scenarioId: number): Promise<{ participation_id: number; scenario_id: number } | null> {
  return apiCall(`/api/game/start`, {
    method: 'POST',
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
}

export type AllocateResult = {
  day_index: number;
  portfolio_value: number;
  return_rate: number;
  is_finalized: boolean;
  // 시즌 종료(7일차 확정) 시에만 의미 있는 값
  granted_exp: number;
  new_level: number | null;
  new_exp: number | null;
  leveled_up: boolean;
  gained_levels: number;
};

export async function confirmAllocation(
  participationId: number,
  allocations: Record<string, number>,
  tags: string[],
  memo: string,
): Promise<AllocateResult | null> {
  return apiCall<AllocateResult>(`/api/game/participation/${participationId}/allocate`, {
    method: 'POST',
    body: JSON.stringify({ allocations, tags, memo }),
  });
}

// [DEV ONLY] 시나리오 진행 전체 초기화 - 테스트 전용, 배포 전 제거 필요
export async function devResetParticipation(): Promise<{ deleted_count: number } | null> {
  return apiCall(`/api/game/dev/reset-all`, { method: 'POST' });
}

// [DEV ONLY] 다음 일차 강제 이동 - 테스트 전용, 배포 전 제거 필요
export async function devAdvanceDay(participationId: number): Promise<{ today_index: number } | null> {
  return apiCall(`/api/game/participation/${participationId}/dev/advance-day`, { method: 'POST' });
}

export async function fetchScenarios(): Promise<ScenarioInfo[]> {
  return (await apiCall<ScenarioInfo[]>(`/api/game/scenarios`, {}, [])) ?? [];
}

export type GameScore = {
  participation_id: number;
  final_return: number | null;
  correct_strategy_return: number | null;
  return_score: number | null;
  scenario_score: number | null;
  diversity_score: number | null;
  stability_score: number | null;
  total_score: number | null;
  rank: number | null;
  total_participants: number | null;
  percentile: number | null;
};

export async function fetchGameScore(participationId: number): Promise<GameScore | null> {
  return apiCall<GameScore>(`/api/game/participation/${participationId}/score`);
}

export type GameReview = {
  good_judgment: string;
  bad_judgment: string;
  overall_review: string;
};

export async function fetchGameReview(participationId: number): Promise<GameReview | null> {
  return apiCall<GameReview>(`/api/game/participation/${participationId}/review`);
}
