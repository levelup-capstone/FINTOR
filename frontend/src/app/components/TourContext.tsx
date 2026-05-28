import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { TOUR_STEPS, TOUR_SEEN_KEY, type TourStep } from '../data/tourSteps';

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

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  // -1: 비활성, 0~N-1: 진행 중
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // 신규 계정(level=1, exp=0) + 같은 브라우저에서 아직 안 본 경우에만 자동 시작
  useEffect(() => {
    if (currentIndex !== -1) return;
    if (localStorage.getItem(TOUR_SEEN_KEY)) return;        // 이 브라우저에서 이미 봄/건너뜀
    if (location.pathname !== '/dashboard') return;

    let userId: number | undefined;
    try {
      userId = JSON.parse(localStorage.getItem('loginResult') || 'null')?.data?.userId;
    } catch { /* ignore */ }
    if (!userId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetch(`/api/v1/users/${userId}/level`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        // 계정 기준 신규 판단: 레벨 1 + 경험치 0 (한 번도 활동 안 한 계정)
        if (json.success && json.data.level === 1 && json.data.exp === 0) {
          timer = setTimeout(() => setCurrentIndex(0), 600);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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
    localStorage.setItem(TOUR_SEEN_KEY, '1');
    setCurrentIndex(-1);
  }, []);

  const start = useCallback(() => setCurrentIndex(0), []);

  const next = useCallback(() => {
    setCurrentIndex((idx) => {
      if (idx < 0) return -1;
      if (idx + 1 >= TOUR_STEPS.length) {
        localStorage.setItem(TOUR_SEEN_KEY, '1');
        return -1;
      }
      return idx + 1;
    });
  }, []);

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
