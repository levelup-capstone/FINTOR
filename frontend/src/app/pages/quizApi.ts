const API_BASE = '';

function authHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
    if (!json.success) {
      console.error(`[Quiz API] ${path} failed:`, json);
    }
    if (json.success) return json.data as T;
    return fallback;
  } catch (e) {
    console.error(`[Quiz API] ${path} error:`, e);
    return fallback;
  }
}

export type QuizQuestion = {
  id: number;
  category: string;
  quiz_type: 'ox' | 'multiple';
  question: string;
  options: string[];
};

export type DailyCompletionData = {
  correct_count: number;
  total: number;
  streak: number;
  results: boolean[];
};

export type TodayQuizData = {
  questions: QuizQuestion[];
  today_total: number;
  already_completed: boolean;
  current_streak: number;
  completion: DailyCompletionData | null;
};

export type SubmitResult = {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  weight: number;
  correct_streak: number;
};

export type QuizStatus = {
  accuracy: number;
  streak: number;
  today_done: boolean;
  today_completion: {
    correct_count: number;
    total: number;
    results: boolean[];
  } | null;
};

export async function fetchTodayQuiz(): Promise<TodayQuizData | null> {
  return apiCall<TodayQuizData>('/api/quiz/today');
}

export async function submitAnswer(questionId: number, selectedAnswer: string): Promise<SubmitResult | null> {
  return apiCall<SubmitResult>(`/api/quiz/${questionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ selected_answer: selectedAnswer }),
  });
}

export async function checkAnswer(questionId: number, selectedAnswer: string): Promise<SubmitResult | null> {
  return apiCall<SubmitResult>(`/api/quiz/${questionId}/check`, {
    method: 'POST',
    body: JSON.stringify({ selected_answer: selectedAnswer }),
  });
}

export async function fetchQuizStatus(): Promise<QuizStatus | null> {
  return apiCall<QuizStatus>('/api/quiz/status');
}

export type RankingEntry = {
  rank: number;
  nickname: string;
  score: number;
  is_me: boolean;
};

export type RankingData = {
  my_rank: number | null;
  my_score: number;
  total_users: number;
  entries: RankingEntry[];
};

export async function fetchInfinitePool(): Promise<QuizQuestion[] | null> {
  const data = await apiCall<{ questions: QuizQuestion[] }>('/api/quiz/pool');
  return data?.questions ?? null;
}

export async function submitInfiniteScore(score: number): Promise<{ best_score: number } | null> {
  return apiCall<{ best_score: number }>('/api/quiz/infinite/score', {
    method: 'POST',
    body: JSON.stringify({ score }),
  });
}

export async function fetchRanking(): Promise<RankingData | null> {
  return apiCall<RankingData>('/api/quiz/ranking');
}

export async function completeDailyQuiz(
  correctCount: number,
  total: number,
  streak: number,
  results: boolean[],
): Promise<boolean> {
  const result = await apiCall<{ date: string }>('/api/quiz/daily/complete', {
    method: 'POST',
    body: JSON.stringify({ correct_count: correctCount, total, streak, results }),
  });
  return result !== null;
}

// TODO: 배포 전 제거 — DEV 전용: 오늘 일일 퀴즈 완료 기록 DB에서 삭제
export async function devResetDailyQuiz(): Promise<boolean> {
  const result = await apiCall<{ deleted: boolean }>('/api/quiz/dev/reset-daily', { method: 'POST' });
  return result !== null;
}
