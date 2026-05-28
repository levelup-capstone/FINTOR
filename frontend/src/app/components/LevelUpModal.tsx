import { useEffect, useMemo } from 'react';

export type LevelUpPayload = {
  /** 새 레벨 (예: 7) */
  newLevel: number;
  /** 한 번에 오른 레벨 수 (보통 1, 큰 보상 받으면 2+) */
  gainedLevels: number;
  /** 이번에 부여된 총 EXP (퀴즈+보너스 모두 포함) */
  granted: number;
  /** streak milestone 보너스 EXP (없으면 0) */
  milestoneBonus?: number;
  /** streak milestone 도달 일수 (10/30/100 또는 null) */
  milestoneReached?: number | null;
  /** "오늘의 퀴즈" / "시즌 완주" 등 출처 표기 */
  source?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  payload: LevelUpPayload | null;
};

export function LevelUpModal({ open, onClose, payload }: Props) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    // 모달 떠있는 동안 body 스크롤 잠금
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  if (!open || !payload) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadein"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="레벨업"
    >
      <Confetti />

      <div
        className="relative bg-gradient-to-br from-white via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full mx-4 text-center animate-popin"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-bold tracking-[0.3em] text-on-surface-variant uppercase mb-2">
          {payload.source ?? '축하합니다!'}
        </p>
        <h2 className="text-4xl md:text-5xl font-black font-headline tracking-tight text-[#1A237E] dark:text-indigo-200 italic mb-1">
          LEVEL UP
        </h2>

        <div className="flex items-baseline justify-center gap-2 my-6">
          <span className="text-7xl md:text-8xl font-black tabular-nums bg-gradient-to-br from-[#1A237E] via-[#7C4DFF] to-[#D500F9] bg-clip-text text-transparent drop-shadow-sm">
            {payload.newLevel}
          </span>
          <span className="text-2xl font-bold text-on-surface-variant">Lv.</span>
        </div>

        {payload.gainedLevels > 1 && (
          <p className="inline-block bg-amber-100 text-amber-700 text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-4">
            ⚡ {payload.gainedLevels} 레벨 한 번에 상승
          </p>
        )}

        <div className="bg-white/70 dark:bg-slate-800/70 rounded-2xl p-4 mb-2 border border-outline-variant/30">
          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mb-1">획득 EXP</p>
          <p className="text-3xl font-black text-[#1A237E] dark:text-indigo-200 tabular-nums">
            +{payload.granted}
          </p>
        </div>

        {payload.milestoneReached != null && payload.milestoneBonus ? (
          <div className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-xl px-4 py-2 mt-3 text-sm font-bold border border-orange-200 dark:border-orange-800">
            🔥 {payload.milestoneReached}일 streak 달성! 보너스 +{payload.milestoneBonus} EXP
          </div>
        ) : null}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-[#1A237E] text-white font-bold text-base py-3.5 rounded-xl hover:bg-[#1f2a8c] hover:shadow-md active:scale-95 transition-all"
        >
          계속하기
        </button>
      </div>

      <style>{`
        @keyframes fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes popin {
          0%   { opacity: 0; transform: scale(0.7) translateY(20px); }
          70%  { opacity: 1; transform: scale(1.04) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fadein { animation: fadein 200ms ease-out; }
        .animate-popin  { animation: popin 450ms cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
    </div>
  );
}

// ─── CSS-only 컨페티 (외부 라이브러리 없음) ──────────────────────────────────
function Confetti() {
  const colors = ['#1A237E', '#7C4DFF', '#D500F9', '#FF4081', '#FFA726', '#FFEB3B', '#26C6DA', '#66BB6A'];
  // useMemo로 한 번만 생성 — 리렌더 시 위치 재생성 방지
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id:        i,
        left:      Math.random() * 100,
        duration:  2.5 + Math.random() * 2,
        delay:     Math.random() * 0.6,
        color:     colors[i % colors.length],
        size:      6 + Math.random() * 10,
        rotation:  Math.random() * 360,
        drift:     (Math.random() - 0.5) * 200,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left:               `${p.left}%`,
            width:              `${p.size}px`,
            height:             `${p.size * 0.4}px`,
            backgroundColor:    p.color,
            animationDuration:  `${p.duration}s`,
            animationDelay:     `${p.delay}s`,
            transform:          `rotate(${p.rotation}deg)`,
            ['--drift' as any]: `${p.drift}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(720deg); opacity: 0.2; }
        }
        .confetti-piece {
          position: absolute;
          top: 0;
          border-radius: 2px;
          animation-name: confetti-fall;
          animation-timing-function: cubic-bezier(0.35, 0.1, 0.6, 1);
          animation-fill-mode: forwards;
          animation-iteration-count: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .confetti-piece { display: none; }
        }
      `}</style>
    </div>
  );
}
