import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SIMULATOR_TOUR_STEPS, type SimulatorTourStep } from '../data/simulatorTourSteps';

type SimulatorTourContextValue = {
  currentIndex: number;
  currentStep: SimulatorTourStep | null;
  isLastStep: boolean;
  totalSteps: number;
  start: () => void;
  next: () => void;
  skip: () => void;
};

const SimulatorTourContext = createContext<SimulatorTourContextValue | null>(null);

export function useSimulatorTour(): SimulatorTourContextValue {
  const ctx = useContext(SimulatorTourContext);
  if (!ctx) throw new Error('useSimulatorTour must be used within SimulatorTourProvider');
  return ctx;
}

// loginResult에서 userId와 simulatorTourDone을 읽는 헬퍼
function getLoginResult(): { userId: number; simulatorTourDone: boolean } | null {
  try {
    const raw = localStorage.getItem('loginResult');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = parsed?.data;
    if (!data?.userId) return null;
    return { userId: data.userId, simulatorTourDone: !!data.simulatorTourDone };
  } catch {
    return null;
  }
}

async function markSimulatorTourDone(userId: number): Promise<void> {
  const token = localStorage.getItem('accessToken');
  await fetch(`/api/v1/users/${userId}/tour`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ simulatorTourDone: true }),
  });
  // loginResult 캐시도 갱신
  try {
    const raw = localStorage.getItem('loginResult');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.data.simulatorTourDone = true;
    localStorage.setItem('loginResult', JSON.stringify(parsed));
  } catch { /* ignore */ }
}

export function SimulatorTourProvider({ children }: { children: ReactNode }) {
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // SimulatorDashboard 마운트 시 DB 기반으로 투어 표시 여부 결정
  useEffect(() => {
    if (currentIndex !== -1) return;

    const result = getLoginResult();
    if (!result) return;
    if (result.simulatorTourDone) return;

    const id = setTimeout(() => setCurrentIndex(0), 800);
    return () => clearTimeout(id);
  }, [currentIndex]);

  const finish = useCallback(() => {
    const result = getLoginResult();
    if (result) {
      // loginResult 캐시를 동기적으로 먼저 갱신 — setCurrentIndex(-1) 이후 effect 재실행 시 재시작 방지
      try {
        const raw = localStorage.getItem('loginResult');
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.data.simulatorTourDone = true;
          localStorage.setItem('loginResult', JSON.stringify(parsed));
        }
      } catch { /* ignore */ }
      markSimulatorTourDone(result.userId);
    }
    setCurrentIndex(-1);
  }, []);

  const start = useCallback(() => setCurrentIndex(0), []);

  const next = useCallback(() => {
    setCurrentIndex((idx) => {
      if (idx < 0) return -1;
      if (idx + 1 >= SIMULATOR_TOUR_STEPS.length) {
        finish();
        return -1;
      }
      return idx + 1;
    });
  }, [finish]);

  const skip = useCallback(() => finish(), [finish]);

  const value = useMemo<SimulatorTourContextValue>(
    () => ({
      currentIndex,
      currentStep: currentIndex >= 0 ? SIMULATOR_TOUR_STEPS[currentIndex] : null,
      isLastStep: currentIndex === SIMULATOR_TOUR_STEPS.length - 1,
      totalSteps: SIMULATOR_TOUR_STEPS.length,
      start,
      next,
      skip,
    }),
    [currentIndex, start, next, skip],
  );

  return <SimulatorTourContext.Provider value={value}>{children}</SimulatorTourContext.Provider>;
}
