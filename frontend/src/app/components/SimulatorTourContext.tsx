import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SIMULATOR_TOUR_STEPS, SIMULATOR_TOUR_SEEN_KEY, type SimulatorTourStep } from '../data/simulatorTourSteps';

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

export function SimulatorTourProvider({ children }: { children: ReactNode }) {
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // SimulatorDashboard 마운트 시 자동 시작 (첫 시즌 참여자만)
  useEffect(() => {
    if (currentIndex !== -1) return;
    if (localStorage.getItem(SIMULATOR_TOUR_SEEN_KEY)) return;
    // 렌더 안정화 대기 (시즌 데이터 fetch + 차트 그리는 시간)
    const id = setTimeout(() => setCurrentIndex(0), 800);
    return () => clearTimeout(id);
  }, [currentIndex]);

  const finish = useCallback(() => {
    localStorage.setItem(SIMULATOR_TOUR_SEEN_KEY, '1');
    setCurrentIndex(-1);
  }, []);

  const start = useCallback(() => setCurrentIndex(0), []);

  const next = useCallback(() => {
    setCurrentIndex((idx) => {
      if (idx < 0) return -1;
      if (idx + 1 >= SIMULATOR_TOUR_STEPS.length) {
        localStorage.setItem(SIMULATOR_TOUR_SEEN_KEY, '1');
        return -1;
      }
      return idx + 1;
    });
  }, []);

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
