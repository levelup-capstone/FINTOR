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
  is_solved: boolean;
};

export type TodayQuizData = {
  questions: QuizQuestion[];
  today_total: number;
};

export type SubmitResult = {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  weight: number;
  correct_streak: number;
};

export type QuizStatus = {
  total_questions: number;
  attempted: number;
  mastered: number;
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

export async function fetchQuizStatus(): Promise<QuizStatus | null> {
  return apiCall<QuizStatus>('/api/quiz/status');
}
