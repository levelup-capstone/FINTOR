import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { fetchParticipation, fetchGameScore, devResetParticipation, type ParticipationData, type GameScore } from './simulatorApi';

export function SimulatorResult() {
  const navigate = useNavigate();
  const [pData, setPData] = useState<ParticipationData | null>(null);
  const [scoreData, setScoreData] = useState<GameScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = localStorage.getItem('participationId');
    if (!pid) { setLoading(false); return; }
    fetchParticipation(Number(pid)).then(async (d) => {
      setPData(d);
      if (d?.is_finalized) {
        const score = await fetchGameScore(Number(pid));
        setScoreData(score);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="w-full h-32 bg-surface-container-lowest rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!pData) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center py-20 text-on-surface-variant">
        <span className="material-symbols-outlined text-5xl opacity-40">sports_esports</span>
        <p className="font-semibold">진행 중인 시뮬레이션이 없습니다.</p>
        <button
          onClick={() => navigate('/dashboard/simulator')}
          className="px-5 py-2.5 rounded-xl bg-[#1A237E] text-white font-bold text-sm"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const { scenario, total_return, current_value, initial_cash, allocations } = pData;
  const TOTAL_DAYS = 7;

  // 최종 수익금
  const finalProfit = Math.floor(current_value - initial_cash);
  const isProfitUp = finalProfit >= 0;

  // 자산 추이 (7일치 평가액)
  const equityHistory = Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const a = allocations.find((x) => x.day_index === i + 1);
    return a?.portfolio_value ?? null;
  });
  const knownValues = [initial_cash, ...equityHistory.filter((v): v is number => v !== null)];
  const rawMin = Math.min(...knownValues);
  const rawMax = Math.max(...knownValues);
  const center = (rawMin + rawMax) / 2;
  const halfEffective = Math.max((rawMax - rawMin) / 2, initial_cash * 0.02);
  const yPad = halfEffective * 0.4;
  const yMin = center - halfEffective - yPad;
  const yMax = center + halfEffective + yPad;
  const yRange = yMax - yMin || 1;
  const toY = (v: number) => 100 - ((v - yMin) / yRange) * 100;
  const equityPoints = equityHistory
    .map((v, i) => (v === null ? null : { x: (i / (TOTAL_DAYS - 1)) * 100, y: toY(v), v, day: i + 1 }))
    .filter((p): p is { x: number; y: number; v: number; day: number } => p !== null);
  const equityPath = equityPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const equityArea = equityPath
    ? `${equityPath} L ${equityPoints[equityPoints.length - 1].x.toFixed(2)} 100 L ${equityPoints[0].x.toFixed(2)} 100 Z`
    : '';
  const initialCashY = toY(initial_cash);

  const returnScore    = scoreData?.return_score    ?? 0;
  const scenarioScore  = scoreData?.scenario_score  ?? 0;
  const diversityScore = scoreData?.diversity_score ?? 0;
  const stabilityScore = scoreData?.stability_score ?? 0;
  const totalScore     = scoreData?.total_score     ?? 0;

  const rank = scoreData?.rank ?? null;
  const totalUsers = scoreData?.total_participants ?? null;
  const topPct = scoreData?.percentile ?? null;

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Celebration Header */}
      <header className="flex items-center gap-4 border-b border-outline-variant/30 pb-4">
        <div className="w-12 h-12 rounded-full bg-[#1A237E]/10 text-[#1A237E] flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: '"FILL" 1' }}>celebration</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface truncate">시즌 #{scenario.stage} 종료 · {scenario.theme}</h1>
          <p className="text-sm font-medium text-on-surface-variant mt-1">최종 투자 결과 및 AI 분석 리포트</p>
        </div>
      </header>



      {/* 2 & 3. Score + Ranking */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score Card */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6 flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            <div
              className="w-40 h-40 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(#1A237E ${totalScore}%, #efecf5 ${totalScore}% 100%)` }}
            >
              <div className="bg-surface-container-lowest rounded-full w-[85%] h-[85%] flex flex-col items-center justify-center">
                <span className="text-3xl font-black tracking-tight text-[#1A237E]">{Math.round(totalScore)}</span>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">/ 100</span>
              </div>
            </div>
            <span className="text-base font-bold text-on-surface">종합 투자 점수</span>
          </div>
          <div className="flex-1 w-full flex flex-col gap-4 md:border-l border-outline-variant/30 md:pl-6 pt-4 md:pt-0">
            <ScoreBar label="수익률" score={Math.round(returnScore)} max={30} />
            <ScoreBar label="시나리오 적응" score={Math.round(scenarioScore)} max={30} />
            <ScoreBar label="분산투자" score={Math.round(diversityScore)} max={20} />
            <ScoreBar label="안정성" score={Math.round(stabilityScore)} max={20} />
          </div>
        </div>

        {/* Ranking Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-outline-variant/30 transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: '"FILL" 1' }}>workspace_premium</span>
          </div>
          <div className="relative z-10 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Final Rank</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-[#1A237E]">
                {rank ?? '-'}<span className="text-2xl text-on-surface-variant ml-1">위</span>
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">전체 {totalUsers ?? '-'}명 중</p>
          </div>
          <div className="relative z-10 mt-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A237E]/10 rounded-full">
              <span className="material-symbols-outlined text-[#1A237E] text-[16px]" style={{ fontVariationSettings: '"FILL" 1' }}>trending_up</span>
              <span className="text-sm font-bold text-[#1A237E]">
                {topPct !== null ? `상위 ${topPct}% 달성` : '순위 집계 중'}
              </span>
            </div>
          </div>
        </div>
      </section>

            {/* 1.5 최종 수익금 + 자산 추이 */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 최종 수익금 (강조) */}
        <div className={`lg:col-span-2 rounded-2xl p-6 shadow-sm border-2 flex flex-col gap-3 justify-center ${
          isProfitUp
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined ${isProfitUp ? 'text-emerald-700' : 'text-red-700'}`} style={{ fontVariationSettings: '"FILL" 1' }}>
              {isProfitUp ? 'trending_up' : 'trending_down'}
            </span>
            <span className={`text-xs font-bold uppercase tracking-widest ${isProfitUp ? 'text-emerald-700' : 'text-red-700'}`}>
              최종 수익금
            </span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className={`text-3xl md:text-5xl font-black tracking-tight ${isProfitUp ? 'text-emerald-700' : 'text-red-700'}`}>
              {isProfitUp ? '+' : ''}₩{Math.abs(finalProfit).toLocaleString()}
            </span>
            <span className={`text-lg font-bold ${isProfitUp ? 'text-emerald-700' : 'text-red-700'}`}>
              ({isProfitUp ? '+' : ''}{total_return.toFixed(2)}%)
            </span>
          </div>
          <div className="text-xs font-semibold text-on-surface-variant flex items-center gap-2 flex-wrap">
            <span>시작 ₩{initial_cash.toLocaleString()}</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            <span>종료 ₩{Math.floor(current_value).toLocaleString()}</span>
          </div>
        </div>

        {/* 자산 추이 */}
        <div className="lg:col-span-3 bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1A237E]">timeline</span>
              자산 추이
            </h3>
            <span className="text-xs font-semibold text-on-surface-variant">Day 1 → Day {TOTAL_DAYS}</span>
          </div>
          <div className="relative h-44 w-full">
            <div className="absolute inset-0 border-b border-l border-outline-variant/30" />
            {/* 시작선 (initial_cash) */}
            <div className="absolute w-full border-t border-dashed border-outline-variant" style={{ top: `${initialCashY}%` }}>
              <span className="absolute -top-4 right-0 text-[10px] font-semibold text-on-surface-variant">
                ₩{(initial_cash / 1_000_000).toFixed(0)}M (시작)
              </span>
            </div>
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              {equityArea && (
                <path d={equityArea} fill={isProfitUp ? '#10b981' : '#dc2626'} fillOpacity="0.08" />
              )}
              {equityPath && (
                <path d={equityPath} fill="none" stroke="#1A237E" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            {/* 데이터 점 */}
            {equityPoints.map((p) => (
              <div
                key={p.day}
                className="absolute w-2.5 h-2.5 bg-white border-2 border-[#1A237E] rounded-full shadow-sm"
                style={{ left: `calc(${p.x}% - 5px)`, top: `calc(${p.y}% - 5px)` }}
                title={`Day ${p.day}: ₩${Math.floor(p.v).toLocaleString()}`}
              />
            ))}
            <div className="absolute -bottom-5 w-full flex justify-between text-[11px] font-semibold text-on-surface-variant px-1">
              {['D1','D2','D3','D4','D5','D6','D7'].map((d) => <span key={d}>{d}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* 4. AI Retrospective */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <span className="material-symbols-outlined text-[#1A237E]">smart_toy</span>
          <h3 className="text-xl font-black tracking-tight text-on-surface">AI 회고 리포트</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RetroCard icon="monitoring" title="시나리오 해설" tone="primary">
            {scenario.recap_text ?? '데이터가 존재하지 않습니다.'}
          </RetroCard>
          {/* Key Lesson (강조) */}
          <div className="bg-[#1A237E]/5 border-2 border-[#1A237E]/30 rounded-2xl p-6 flex flex-col justify-center gap-3">
            <div className="flex items-center gap-2 text-[#1A237E]">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>lightbulb</span>
              <span className="text-xs font-bold uppercase tracking-widest">Key Lesson</span>
            </div>
            <p className="text-xl md:text-2xl font-black tracking-tight text-on-surface leading-tight whitespace-pre-line">
              {scenario.key_lesson ?? '데이터가 존재하지 않습니다.'}
            </p>
          </div>
          <RetroCard icon="price_check" title="좋았던 판단" tone="primary">
            초기 배당주 비중 확대로 인해 하락장에서도 안정적인 방어가 가능했습니다. 특히 금융 섹터 편입은 이번 시즌 가장 성공적인 결정으로 분석됩니다.
          </RetroCard>
          <RetroCard icon="warning" title="아쉬운 판단" tone="error">
            기술주 반등을 너무 이르게 예측하여 손절매 타이밍을 놓친 점이 수익률 저하의 주된 원인입니다. 매크로 지표 확인 전 선취매는 리스크가 높습니다.
          </RetroCard>
        </div>
      </section>

      {/* 5. Personal Decision Analysis */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6">
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-surface-container text-on-surface flex items-center justify-center flex-shrink-0 mt-1">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <div>
            <h4 className="text-base font-bold text-on-surface mb-1">총평 및 다음 시즌 조언</h4>
            <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
              전반적으로 리스크 관리에 대한 이해도가 높으나, 확실한 기회에서 과감한 베팅이 부족했습니다. 다음 시즌에서는 포트폴리오의 10-15%를 알파 수익 창출을 위한 전술적 자산 배분으로 활용해 보시는 것을 추천합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Actions */}
      <section className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4 border-t border-outline-variant/30">
        {/* [DEV ONLY] 시나리오 진행 초기화 버튼 - 테스트 전용, 배포 전 제거 필요 */}
        <button
          onClick={async () => {
            if (!confirm('[DEV] 모든 회차 진행을 초기화하시겠습니까?\nDB에 기록된 모든 배분 내역이 삭제됩니다.')) return;
            const result = await devResetParticipation(); // DEV ONLY
            if (result) {
              localStorage.removeItem('participationId');
              navigate('/dashboard/simulator');
            }
          }}
          className="w-full sm:w-auto px-6 py-3 rounded-xl border-2 border-dashed border-red-400 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
          title="[DEV] 시나리오 초기화"
        >
          <span className="material-symbols-outlined text-[20px]">restart_alt</span>
          [DEV] 초기화
        </button>
        <button
          onClick={() => navigate('/dashboard/simulator/season/calendar')}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-surface-container text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">calendar_month</span>
          캘린더 보기
        </button>
        <button
          onClick={() => navigate('/dashboard/simulator')}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#1A237E] text-white font-bold text-sm hover:bg-[#1A237E]/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          시뮬레이터로 돌아가기
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </section>
    </div>
  );
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max === 0 ? 0 : (score / max) * 100;
  return (
    <div>
      <div className="flex justify-between mb-1 flex-wrap gap-x-2">
        <span className="text-sm font-semibold text-on-surface-variant">{label}</span>
        <span className="text-sm font-semibold text-on-surface tabular-nums">{score}/{max}점</span>
      </div>
      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
        <div className="bg-[#1A237E] h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RetroCard({ icon, title, tone, children }: { icon: string; title: string; tone: 'primary' | 'error'; children: ReactNode }) {
  const toneCls = tone === 'error' ? 'text-red-700' : 'text-[#1A237E]';
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6 flex flex-col gap-3">
      <div className={`flex items-center gap-2 ${toneCls}`}>
        <span className="material-symbols-outlined">{icon}</span>
        <span className="text-base font-bold">{title}</span>
      </div>
      <p className="text-sm font-medium text-on-surface-variant leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  );
}
