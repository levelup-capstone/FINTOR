import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { useTour } from './TourContext';

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;         // 타겟 주변 spotlight 여유
const BOX_GAP = 16;        // 타겟과 안내 박스 사이 간격
const BOX_MAX_W = 360;

export function TourOverlay() {
  const { currentStep, currentIndex, totalSteps, isLastStep, next, skip } = useTour();
  const location = useLocation();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  // 타겟 요소 찾기 + 스크롤 + 위치 측정
  useLayoutEffect(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }
    // 페이지 전환 직후엔 path가 다를 수 있음 — 일치할 때만 진행
    if (location.pathname !== currentStep.path) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let attemptCount = 0;
    const maxAttempts = 40; // 약 4초

    const findAndShow = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${currentStep.target}"]`);
      if (!el) {
        attemptCount += 1;
        if (attemptCount < maxAttempts) {
          setTimeout(findAndShow, 100);
        }
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 스크롤 완료 후 측정
      setTimeout(() => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }, 350);
    };

    findAndShow();
    return () => { cancelled = true; };
  }, [currentStep, location.pathname]);

  // resize/scroll 시 위치 재계산
  useEffect(() => {
    if (!currentStep) return;
    const recompute = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${currentStep.target}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [currentStep]);

  if (!currentStep || !targetRect) return null;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const isMobile = viewportW < 768;

  // 키 큰 타겟(시즌 챌린지 카드 등) → 위/아래로는 박스가 화면 밖으로 밀림
  const targetIsTall = targetRect.height > viewportH * 0.55;

  const spaceBelow = viewportH - (targetRect.top + targetRect.height);
  const spaceAbove = targetRect.top;
  const spaceRight = viewportW - (targetRect.left + targetRect.width);
  const spaceLeft = targetRect.left;
  const SIDE_NEEDED = BOX_MAX_W + BOX_GAP * 2; // 사이드 배치에 필요한 최소 공간

  type Placement = 'below' | 'above' | 'right' | 'left' | 'pinned';
  let placement: Placement;

  if (isMobile) {
    // 모바일: 위/아래 공간 충분 시 그 방향, 둘 다 부족하면 화면 하단 고정
    if (spaceBelow >= 240) placement = 'below';
    else if (spaceAbove >= 240) placement = 'above';
    else placement = 'pinned';
  } else if (targetIsTall) {
    // 키 큰 타겟은 사이드 우선
    if (spaceRight >= SIDE_NEEDED) placement = 'right';
    else if (spaceLeft >= SIDE_NEEDED) placement = 'left';
    else placement = 'pinned';
  } else {
    // 일반 타겟: 위/아래 우선, 안 되면 사이드, 최후 pinned
    if (spaceBelow >= 240) placement = 'below';
    else if (spaceAbove >= 240) placement = 'above';
    else if (spaceRight >= SIDE_NEEDED) placement = 'right';
    else if (spaceLeft >= SIDE_NEEDED) placement = 'left';
    else placement = 'pinned';
  }

  const clampX = (x: number) => Math.max(16, Math.min(viewportW - BOX_MAX_W - 16, x));
  const clampY = (y: number) => Math.max(16, Math.min(viewportH - 280 - 16, y));
  const centerY = targetRect.top + targetRect.height / 2;
  const HALF_BOX_H = 140; // 박스 추정 높이 절반 (수직 중앙 정렬용)

  let boxStyle: React.CSSProperties;
  switch (placement) {
    case 'below':
      boxStyle = { top: targetRect.top + targetRect.height + BOX_GAP, left: clampX(targetRect.left) };
      break;
    case 'above':
      boxStyle = { bottom: viewportH - targetRect.top + BOX_GAP, left: clampX(targetRect.left) };
      break;
    case 'right':
      boxStyle = { top: clampY(centerY - HALF_BOX_H), left: targetRect.left + targetRect.width + BOX_GAP };
      break;
    case 'left':
      boxStyle = { top: clampY(centerY - HALF_BOX_H), right: viewportW - targetRect.left + BOX_GAP };
      break;
    case 'pinned':
    default:
      // 모든 배치가 불가능할 때: 모바일은 하단 가로, 데스크탑은 우하단
      boxStyle = isMobile
        ? { bottom: 16, left: 16, right: 16 }
        : { bottom: 16, right: 16 };
      break;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label="사이트 안내 투어"
    >
      {/* Spotlight: 어두운 백드롭 + 타겟만 밝게 (box-shadow 사용) */}
      <div
        className="absolute rounded-xl pointer-events-none transition-all duration-300"
        style={{
          top: targetRect.top - PADDING,
          left: targetRect.left - PADDING,
          width: targetRect.width + PADDING * 2,
          height: targetRect.height + PADDING * 2,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
        }}
      />

      {/* 안내 박스 */}
      <div
        className="fixed bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 w-[calc(100vw-32px)] max-w-[360px] animate-tour-popin"
        style={boxStyle}
      >
        {/* 상단: 진행도 + 건너뛰기 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'w-6 bg-[#1A237E]'
                    : i < currentIndex
                    ? 'w-1.5 bg-[#1A237E]/60'
                    : 'w-1.5 bg-slate-300'
                }`}
              />
            ))}
          </div>
          <button
            onClick={skip}
            className="text-[11px] font-semibold text-on-surface-variant hover:text-[#1A237E] transition-colors"
          >
            건너뛰기
          </button>
        </div>

        {/* 제목 + 본문 */}
        <h3 className="text-lg font-extrabold text-[#1A237E] dark:text-indigo-200 mb-2">
          {currentStep.title}
        </h3>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
          {currentStep.body}
        </p>

        {/* 다음 버튼 */}
        <button
          onClick={next}
          className="w-full bg-[#1A237E] text-white font-bold text-sm py-2.5 rounded-xl hover:bg-[#1f2a8c] hover:shadow-md active:scale-95 transition-all"
        >
          {isLastStep ? '완료' : currentStep.nextLabel}
        </button>

        <p className="text-[10px] text-on-surface-variant/60 text-center mt-2">
          {currentIndex + 1} / {totalSteps}
        </p>
      </div>

      <style>{`
        @keyframes tour-popin {
          0%   { opacity: 0; transform: translateY(8px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-tour-popin { animation: tour-popin 250ms cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
    </div>,
    document.body,
  );
}
