import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { TOUR_STEPS, type TourStep } from '../data/tourSteps';

type TourContextValue = {
  currentIndex: number;
  currentStep: TourStep | null;
  isLastStep: boolean;
  totalSteps: number;
  start: () => void;
  next: () => void;
  skip: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

// loginResult에서 userId와 dashboardTourDone을 읽는 헬퍼
function getLoginResult(): { userId: number; dashboardTourDone: boolean } | null {
  try {
    const raw = localStorage.getItem('loginResult');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = parsed?.data;
    if (!data?.userId) return null;
    return { userId: data.userId, dashboardTourDone: !!data.dashboardTourDone };
  } catch {
    return null;
  }
}

async function markDashboardTourDone(userId: number): Promise<void> {
  const token = localStorage.getItem('accessToken');
  await fetch(`/api/v1/users/${userId}/tour`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dashboardTourDone: true }),
  });
  // loginResult 캐시도 갱신
  try {
    const raw = localStorage.getItem('loginResult');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.data.dashboardTourDone = true;
    localStorage.setItem('loginResult', JSON.stringify(parsed));
  } catch { /* ignore */ }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  // -1: 비활성, 0~N-1: 진행 중
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // 대시보드 진입 시 DB 기반으로 투어 표시 여부 결정
  useEffect(() => {
    if (currentIndex !== -1) return;
    if (location.pathname !== '/dashboard') return;

    const result = getLoginResult();
    if (!result) return;
    if (result.dashboardTourDone) return;

    const id = setTimeout(() => setCurrentIndex(0), 600);
    return () => clearTimeout(id);
  }, [location.pathname, currentIndex]);

  // currentIndex 변경 시 해당 step.path와 현재 pathname이 다르면 자동 이동
  useEffect(() => {
    if (currentIndex < 0 || currentIndex >= TOUR_STEPS.length) return;
    const step = TOUR_STEPS[currentIndex];
    if (location.pathname !== step.path) {
      navigate(step.path);
    }
  }, [currentIndex, location.pathname, navigate]);

  const finish = useCallback(() => {
    const result = getLoginResult();
    if (result) {
      // loginResult 캐시를 동기적으로 먼저 갱신 — setCurrentIndex(-1) 이후 effect 재실행 시 재시작 방지
      try {
        const raw = localStorage.getItem('loginResult');
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.data.dashboardTourDone = true;
          localStorage.setItem('loginResult', JSON.stringify(parsed));
        }
      } catch { /* ignore */ }
      markDashboardTourDone(result.userId);
    }
    setCurrentIndex(-1);
  }, []);

  const start = useCallback(() => setCurrentIndex(0), []);

  const next = useCallback(() => {
    setCurrentIndex((idx) => {
      if (idx < 0) return -1;
      if (idx + 1 >= TOUR_STEPS.length) {
        finish();
        return -1;
      }
      return idx + 1;
    });
  }, [finish]);

  const skip = useCallback(() => finish(), [finish]);

  const value = useMemo<TourContextValue>(
    () => ({
      currentIndex,
      currentStep: currentIndex >= 0 ? TOUR_STEPS[currentIndex] : null,
      isLastStep: currentIndex === TOUR_STEPS.length - 1,
      totalSteps: TOUR_STEPS.length,
      start,
      next,
      skip,
    }),
    [currentIndex, start, next, skip],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
