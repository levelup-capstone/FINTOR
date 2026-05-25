import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchParticipation, confirmAllocation, devAdvanceDay, devResetParticipation, type ParticipationData, type DayNews, type AllocateResult } from './simulatorApi';

const TOTAL_DAYS = 7;

// 시즌 종료 시 EXP 부여 결과를 sessionStorage에 잠깐 보관 — Phase 7에서 모달로 표시 예정
function notifySeasonExpIfFinalized(result: AllocateResult) {
  if (!result.is_finalized || result.granted_exp <= 0) return;
  const payload = {
    source: 'season',
    granted: result.granted_exp,
    level: result.new_level,
    exp: result.new_exp,
    leveled_up: result.leveled_up,
    gained_levels: result.gained_levels,
  };
  sessionStorage.setItem('fintor_pending_exp_notify', JSON.stringify(payload));
  console.log(`🎯 시즌 완료! +${result.granted_exp} EXP → Level ${result.new_level} (exp ${result.new_exp})${result.leveled_up ? ` 🎉 LEVEL UP (+${result.gained_levels})` : ''}`);
}
const STEP_PCT = 10;

const ASSET_META: Record<string, { label: string; color: string; accent: string }> = {
  cash:           { label: '현금',     color: '#059669', accent: 'accent-emerald-600' },
  dollar:         { label: '달러',     color: '#16a34a', accent: 'accent-green-600' },
  bonds:          { label: '채권',     color: '#a855f7', accent: 'accent-purple-500' },
  'gov-bonds':    { label: '국채',     color: '#7c3aed', accent: 'accent-violet-600' },
  tips:           { label: 'TIPS',     color: '#6d28d9', accent: 'accent-purple-700' },
  gold:           { label: '금',       color: '#eab308', accent: 'accent-yellow-500' },
  'bluechip-stock': { label: '우량주', color: '#1A237E', accent: 'accent-[#1A237E]' },
  'growth-stock': { label: '성장주',   color: '#dc2626', accent: 'accent-red-600' },
  'dividend-stock': { label: '배당주', color: '#0891b2', accent: 'accent-cyan-600' },
  stocks:         { label: '주식',     color: '#2563eb', accent: 'accent-blue-600' },
  nasdaq:         { label: '나스닥',   color: '#3b82f6', accent: 'accent-blue-500' },
  emerging:       { label: '신흥국',   color: '#0d9488', accent: 'accent-teal-600' },
  coin:           { label: '코인',     color: '#f97316', accent: 'accent-orange-500' },
  bitcoin:        { label: '비트코인', color: '#f59e0b', accent: 'accent-amber-500' },
  reits:          { label: '리츠',     color: '#06b6d4', accent: 'accent-cyan-500' },
  commodities:    { label: '원자재',   color: '#84cc16', accent: 'accent-lime-500' },
  oil:            { label: '원유',     color: '#78716c', accent: 'accent-stone-500' },
  agriculture:    { label: '농산물',   color: '#65a30d', accent: 'accent-lime-600' },
};

const REASON_TAGS = [
  '#금리인하_지연', '#금리인상_우려', '#실적호조', '#실적부진',
  '#안전자산선호', '#위험자산선호', '#기술주랠리', '#기술주조정',
  '#달러강세', '#원화강세', '#인플레이션우려', '#변동성확대',
  '#차트분석', '#감으로',
];

function buildChartPath(history: number[], totalDays: number): string {
  if (history.length < 2) return '';
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const yMin = min - range * 0.2;
  const yMax = max + range * 0.2;
  const yRange = yMax - yMin;
  const xStep = 100 / (totalDays - 1);
  return history
    .map((v, i) => {
      const x = i * xStep;
      const y = 40 - ((v - yMin) / yRange) * 40;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function SimulatorDashboard() {
  const navigate = useNavigate();
  const [pData, setPData] = useState<ParticipationData | null>(null);
  const [loading, setLoading] = useState(true);

  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const [confirmedAlloc, setConfirmedAlloc] = useState<Record<string, number>>({});
  const [todayConfirmed, setTodayConfirmed] = useState(false);
  const [equity, setEquity] = useState(0);
  const [totalReturn, setTotalReturn] = useState(0);

  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [memo, setMemo] = useState('');

  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedMacroIdx, setSelectedMacroIdx] = useState<number | null>(null);
  const [selectedSignalIdx, setSelectedSignalIdx] = useState<number | null>(null);
  const [selectedNewsDay, setSelectedNewsDay] = useState<number>(1);
  const [rebalancingOpen, setRebalancingOpen] = useState(false);
  const [hasOpenedToday, setHasOpenedToday] = useState(false);

  useEffect(() => {
    const pid = localStorage.getItem('participationId');
    if (!pid) { setLoading(false); return; }
    fetchParticipation(Number(pid)).then((d) => {
      if (!d) { setLoading(false); return; }
      setPData(d);
      setEquity(Math.floor(d.current_value));
      setTotalReturn(d.total_return);
      setSelectedNewsDay(d.today_index);

      const todayAlloc = d.allocations.find((a) => a.day_index === d.today_index);
      // 가장 최근에 확정된 배분(ancestor)을 찾음 — 중간에 미확정/미정산 일이 있어도 추적
      let ancestorAlloc: typeof d.allocations[number] | undefined;
      for (let day = d.today_index - 1; day >= 1; day--) {
        const a = d.allocations.find((x) => x.day_index === day);
        if (a) { ancestorAlloc = a; break; }
      }
      const initAlloc: Record<string, number> = {};
      d.scenario.assets.forEach((a) => { initAlloc[a] = 0; });
      if (todayAlloc) {
        Object.assign(initAlloc, todayAlloc.allocations);
        setTodayConfirmed(true);
      } else if (ancestorAlloc) {
        // 가장 최근 확정 배분을 오늘의 초기 배분으로 유지
        Object.assign(initAlloc, ancestorAlloc.allocations);
      }
      setAllocation({ ...initAlloc });
      // confirmedAlloc은 ancestor 기준 (도넛 차트 "현재 배분" 기준)
      const confirmedBase: Record<string, number> = {};
      d.scenario.assets.forEach((a) => { confirmedBase[a] = 0; });
      if (todayAlloc) {
        Object.assign(confirmedBase, todayAlloc.allocations);
      } else if (ancestorAlloc) {
        Object.assign(confirmedBase, ancestorAlloc.allocations);
      }
      setConfirmedAlloc({ ...confirmedBase });

      const journalKey = `fintor_journal_p${d.participation_id}_d${d.today_index}`;
      try {
        const raw = localStorage.getItem(journalKey);
        if (raw) {
          const j = JSON.parse(raw) as { tags: string[]; memo: string };
          setActiveTags(j.tags ?? []);
          setMemo(j.memo ?? '');
        }
      } catch {}

      // 오늘 리밸런싱 카드를 이미 열어본 적 있는지 (참여 + 일자별)
      const rebalKey = `fintor_rebal_opened_p${d.participation_id}_d${d.today_index}`;
      setHasOpenedToday(localStorage.getItem(rebalKey) === '1');

      setLoading(false);
    });
  }, []);

  const markRebalanceOpened = () => {
    if (!pData) return;
    const rebalKey = `fintor_rebal_opened_p${pData.participation_id}_d${pData.today_index}`;
    localStorage.setItem(rebalKey, '1');
    setHasOpenedToday(true);
  };

  useEffect(() => {
    if (!pData) return;
    const journalKey = `fintor_journal_p${pData.participation_id}_d${pData.today_index}`;
    try { localStorage.setItem(journalKey, JSON.stringify({ tags: activeTags, memo })); } catch {}
  }, [activeTags, memo, pData]);

  useEffect(() => {
    const anyOpen = rebalancingOpen || selectedAsset !== null || selectedMacroIdx !== null || selectedSignalIdx !== null;
    if (!anyOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [rebalancingOpen, selectedAsset, selectedMacroIdx, selectedSignalIdx]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="w-full h-32 bg-[#1A237E]/20 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-28 bg-surface-container-lowest rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!pData) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center py-20 text-on-surface-variant">
        <span className="material-symbols-outlined text-5xl opacity-40">sports_esports</span>
        <p className="font-semibold">진행 중인 시뮬레이션이 없습니다.</p>
        <button onClick={() => navigate('/dashboard/simulator')} className="px-5 py-2.5 rounded-xl bg-[#1A237E] text-white font-bold text-sm">돌아가기</button>
      </div>
    );
  }

  const { scenario, today_index, initial_cash, prices, macros, news_by_day, allocations } = pData;
  const todayIdx0 = today_index - 1;

  type MacroItem = { label: string; value: string; delta: string; deltaColor: string; path: string; stroke: string; history: number[]; formatValue: (v: number) => string };
  const macroItems: MacroItem[] = (() => {
    if (macros.length === 0) return [];
    const latest = macros[macros.length - 1];
    const prev = macros.length > 1 ? macros[macros.length - 2] : latest;
    return [
      {
        label: 'CPI', stroke: '#dc2626',
        history: macros.map((m) => m.cpi),
        value: `${latest.cpi.toFixed(1)}%`,
        delta: `${latest.cpi - prev.cpi >= 0 ? '+' : ''}${(latest.cpi - prev.cpi).toFixed(1)}%`,
        deltaColor: latest.cpi - prev.cpi > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700',
        path: buildChartPath(macros.map((m) => m.cpi), TOTAL_DAYS),
        formatValue: (v) => `${v.toFixed(1)}%`,
      },
      {
        label: '기준금리', stroke: '#64748b',
        history: macros.map((m) => m.interest_rate),
        value: `${latest.interest_rate.toFixed(2)}%`,
        delta: `${latest.interest_rate - prev.interest_rate >= 0 ? '+' : ''}${(latest.interest_rate - prev.interest_rate).toFixed(2)}%`,
        deltaColor: 'bg-slate-100 text-slate-600',
        path: buildChartPath(macros.map((m) => m.interest_rate), TOTAL_DAYS),
        formatValue: (v) => `${v.toFixed(2)}%`,
      },
      {
        label: '환율 (USD/KRW)', stroke: '#dc2626',
        history: macros.map((m) => m.fx_usdkrw),
        value: latest.fx_usdkrw.toLocaleString(),
        delta: `${latest.fx_usdkrw - prev.fx_usdkrw >= 0 ? '+' : ''}${(latest.fx_usdkrw - prev.fx_usdkrw).toFixed(0)}`,
        deltaColor: latest.fx_usdkrw - prev.fx_usdkrw > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700',
        path: buildChartPath(macros.map((m) => m.fx_usdkrw), TOTAL_DAYS),
        formatValue: (v) => v.toLocaleString(),
      },
      {
        label: 'VIX', stroke: '#059669',
        history: macros.map((m) => m.vix),
        value: latest.vix.toFixed(1),
        delta: `${latest.vix - prev.vix >= 0 ? '+' : ''}${(latest.vix - prev.vix).toFixed(1)}`,
        deltaColor: latest.vix - prev.vix < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
        path: buildChartPath(macros.map((m) => m.vix), TOTAL_DAYS),
        formatValue: (v) => v.toFixed(1),
      },
    ];
  })();

  const assetItems = scenario.assets.map((key) => {
    const meta = ASSET_META[key] ?? { label: key, color: '#94a3b8', accent: '' };
    const history = prices[key] ?? [];
    const todayPrice = history[todayIdx0] ?? 0;
    const prevPrice = history[todayIdx0 - 1] ?? todayPrice;
    const changePct = prevPrice !== 0 ? ((todayPrice - prevPrice) / prevPrice) * 100 : 0;
    const path = buildChartPath(history.slice(0, today_index), TOTAL_DAYS);
    const todayX = (todayIdx0 / (TOTAL_DAYS - 1)) * 100;
    return { key, meta, history, todayPrice, changePct, path, todayX };
  });

  const currentDayNews: DayNews[] = news_by_day[selectedNewsDay] ?? [];

  const totalRatio = Math.round(Object.values(allocation).reduce((s, v) => s + v, 0) * 100) / 100;
  const totalRatioOk = totalRatio <= 100.01;
  const leftoverRatio = Math.max(0, 100 - totalRatio);
  const leftoverWon = Math.round((leftoverRatio * equity) / 100);

  const confirmedTotal = Math.round(Object.values(confirmedAlloc).reduce((s, v) => s + v, 0) * 100) / 100;
  const confirmedLeftoverRatio = Math.max(0, 100 - confirmedTotal);
  const confirmedLeftoverWon = Math.round((confirmedLeftoverRatio * equity) / 100);

  const updateRatio = (key: string, value: number) => {
    setAllocation((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, value)) }));
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const isLastDay = today_index === TOTAL_DAYS;

  const handleConfirm = async () => {
    if (isLastDay) {
      // Day 7: 강제 전량 현금화로 기록한 뒤 결과 페이지로 이동
      if (!todayConfirmed) {
        const pid = Number(localStorage.getItem('participationId'));
        const cashAllocation = Object.fromEntries(scenario.assets.map((a) => [a, 0]));
        const result = await confirmAllocation(pid, cashAllocation, activeTags, memo);
        if (!result) return;
        setAllocation(cashAllocation);
        setConfirmedAlloc(cashAllocation);
        setTodayConfirmed(true);
        setEquity(Math.floor(result.portfolio_value));
        setTotalReturn(result.return_rate);
        notifySeasonExpIfFinalized(result);
      }
      navigate('/dashboard/simulator/season/result');
      return;
    }
    if (!totalRatioOk || todayConfirmed) return;
    const pid = Number(localStorage.getItem('participationId'));
    const result = await confirmAllocation(pid, allocation, activeTags, memo);
    if (result) {
      setConfirmedAlloc({ ...allocation });
      setTodayConfirmed(true);
      setEquity(Math.floor(result.portfolio_value));
      setTotalReturn(result.return_rate);
      setRebalancingOpen(false);
      notifySeasonExpIfFinalized(result);
      navigate('/dashboard/simulator/season/calendar');
    }
  };

  const equityHistory = Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const a = allocations.find((x) => x.day_index === i + 1);
    return a?.portfolio_value ?? null;
  });
  const knownEquity = equityHistory.filter((v): v is number => v !== null);
  // 오늘 라이브 평가액(equity)이 history에 없으면 포함시킴 (오늘 미확정 케이스)
  const todayInHistory = equityHistory[todayIdx0] != null;
  const allValues = [initial_cash, ...knownEquity, ...(todayInHistory ? [] : [equity])];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  // 데이터가 평평해도 최소 범위 확보 (initial_cash의 4%) + 위아래 20% padding
  const center = (rawMin + rawMax) / 2;
  const halfEffective = Math.max((rawMax - rawMin) / 2, initial_cash * 0.02);
  const yPad = halfEffective * 0.4;
  const yMin = center - halfEffective - yPad;
  const yMax = center + halfEffective + yPad;
  const yRange = yMax - yMin;
  const toY = (v: number) => 100 - ((v - yMin) / yRange) * 100;

  const equityPoints = equityHistory
    .map((v, i) => {
      if (v === null) return null;
      const x = (i / (TOTAL_DAYS - 1)) * 100;
      return { x, y: toY(v), v };
    })
    .filter((p): p is { x: number; y: number; v: number } => p !== null);

  const todayEquityX = (todayIdx0 / (TOTAL_DAYS - 1)) * 100;
  // 오늘 미확정이면 라이브 equity로 점 찍어서 path 연장
  const equityPointsForPath = todayInHistory
    ? equityPoints
    : [...equityPoints, { x: todayEquityX, y: toY(equity), v: equity }];
  const equityPath = equityPointsForPath
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const todayEquityY = toY(equity);
  const initialCashY = toY(initial_cash);

  const isUp = totalReturn >= 0;
  const progressPct = Math.round((today_index / TOTAL_DAYS) * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 시즌 배너 */}
      <section className="bg-[#1A237E] text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-400 rounded-full opacity-20 blur-3xl pointer-events-none" />
        <div className="flex-1 z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-white text-[#1A237E] font-bold px-2 py-1 rounded-full text-[11px] tracking-widest uppercase">
              SEASON #{scenario.stage}
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{scenario.theme}</h1>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="text-sm font-semibold">Day {today_index} / {TOTAL_DAYS}</div>
            <div className="flex-1 max-w-[200px] h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-300 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex gap-6 z-10 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-bold uppercase tracking-widest text-white/70">총 자산</span>
            <span className="text-3xl md:text-4xl font-black tracking-tight">₩{equity.toLocaleString()}</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                <span className="material-symbols-outlined text-[14px]">{isUp ? 'trending_up' : 'trending_down'}</span>
                {isUp ? '+' : ''}{totalReturn.toFixed(2)}%
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/simulator/season/calendar')}
            className="hidden md:flex items-center gap-2 bg-white text-[#1A237E] font-bold px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors text-sm self-center"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            캘린더 보기
          </button>
        </div>
        <button
          onClick={() => navigate('/dashboard/simulator/season/calendar')}
          className="md:hidden flex items-center justify-center gap-2 bg-white text-[#1A237E] font-bold px-4 py-3 rounded-xl hover:bg-indigo-100 transition-colors text-sm w-full z-10 mt-2"
        >
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          캘린더 보기
        </button>
      </section>

      {/* 2. 거시지표 */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {macroItems.map((m, idx) => (
          <button
            key={m.label}
            onClick={() => setSelectedMacroIdx(idx)}
            className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 hover:border-[#1A237E]/30 hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant text-sm">{m.label}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m.deltaColor}`}>{m.delta}</span>
            </div>
            <div className="text-2xl font-black tracking-tight text-on-surface mb-2">{m.value}</div>
            <div className="h-10 w-full">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                <path d={m.path} fill="none" stroke={m.stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </button>
        ))}
      </section>

      {/* 2-1. 오늘의 자산 가격 */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 md:p-6 shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-black tracking-tight text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined">payments</span>
            오늘의 자산 가격
          </h2>
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Day {today_index} 기준</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {assetItems.map((a) => {
            const isUp2 = a.changePct > 0.01;
            const isDown = a.changePct < -0.01;
            return (
              <button
                key={a.key}
                onClick={() => setSelectedAsset(a.key)}
                className="flex flex-col gap-2 p-3 rounded-xl border border-outline-variant/30 hover:bg-surface-container-low hover:border-[#1A237E]/30 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.meta.color }} />
                  <span className="text-sm font-bold text-on-surface truncate">{a.meta.label}</span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <span className="text-base md:text-lg font-black tracking-tight text-on-surface">{a.todayPrice.toFixed(2)}</span>
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${isUp2 ? 'bg-emerald-100 text-emerald-700' : isDown ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                    {isUp2 ? '+' : ''}{a.changePct.toFixed(2)}%
                  </span>
                </div>
                <div className="h-12 w-full mt-1">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                    <path d={a.path} fill="none" stroke={a.meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <line x1={a.todayX} x2={a.todayX} y1="0" y2="40" stroke="#c6c5d4" strokeWidth="1" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. 오늘의 뉴스 */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-black tracking-tight text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined">newspaper</span>
            오늘의 뉴스
          </h2>
          <span className="text-xs font-semibold text-on-surface-variant">
            {selectedNewsDay === today_index ? '오늘' : `Day ${selectedNewsDay}`} · {currentDayNews.length}개
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {Array.from({ length: TOTAL_DAYS }, (_, i) => {
            const day = i + 1;
            const isToday = day === today_index;
            const isLocked = day > today_index;
            const isSelected = day === selectedNewsDay;
            return (
              <button
                key={day}
                onClick={() => !isLocked && setSelectedNewsDay(day)}
                disabled={isLocked}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                  isSelected ? 'bg-[#1A237E] text-white border-[#1A237E]'
                  : isLocked ? 'bg-surface-container-low text-on-surface-variant/40 border-outline-variant/20 cursor-not-allowed'
                  : 'bg-surface-container-high text-on-surface border-outline-variant/30 hover:bg-surface-variant'
                }`}
              >
                Day{day}
                {isToday && (
                  <span className={`text-[9px] font-bold px-1 py-px rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-[#1A237E]/10 text-[#1A237E]'}`}>오늘</span>
                )}
                {isLocked && <span className="material-symbols-outlined text-[14px]">lock</span>}
              </button>
            );
          })}
        </div>
        {currentDayNews.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant gap-2">
            <span className="material-symbols-outlined text-3xl opacity-50">hourglass_empty</span>
            <p className="text-sm font-semibold">아직 해금되지 않은 날입니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {currentDayNews.map((s, i) => (
              <button
                key={i}
                onClick={() => setSelectedSignalIdx(i)}
                className="p-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container-low hover:border-[#1A237E]/30 transition-colors cursor-pointer group text-left w-full flex flex-col"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[12px] font-bold tracking-widest bg-surface-container-high text-on-surface-variant">#{s.news_type}</span>
                </div>
                <h3 className="font-bold text-on-surface text-[18px] group-hover:text-[#1A237E] transition-colors line-clamp-3">{s.title}</h3>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 메인 워크스페이스 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 자산 추이 */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30">
            <h2 className="text-xl font-black tracking-tight text-on-surface mb-4">자산 추이</h2>
            <div className="h-48 w-full relative mt-4">
              <div className="absolute inset-0 border-b border-l border-outline-variant/30" />
              <div className="absolute w-full border-t border-dashed border-outline-variant" style={{ top: `${initialCashY}%` }}>
                <span className="absolute -top-4 right-0 text-[10px] font-semibold text-on-surface-variant">₩{(initial_cash / 1_000_000).toFixed(0)}M (시작)</span>
              </div>
              <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none" viewBox="0 0 100 100">
                {equityPath && <path d={equityPath} fill="none" stroke="#1A237E" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
              </svg>
              <div className="absolute border-dashed border-l-2 border-[#1A237E]" style={{ left: `${todayEquityX}%`, top: 0, bottom: 0 }}>
                <div className="absolute -top-6 -left-5 bg-[#1A237E] text-white text-[13px] font-bold px-2 py-0.5 rounded whitespace-nowrap">D-{today_index}</div>
                <div className="absolute w-[10px] h-[10px] bg-white border-2 border-[#1A237E] rounded-full shadow-sm z-10 -left-[5px]" style={{ top: `${todayEquityY}%` }} />
              </div>
              <div className="absolute -bottom-5 w-full flex justify-between text-[13px] font-semibold text-on-surface-variant px-1">
                {['D1','D2','D3','D4','D5','D6','D7'].map((d) => <span key={d}>{d}</span>)}
              </div>
            </div>
          </section>
        </div>

        {/* 우측: 포트폴리오 리밸런싱 요약 (클릭 시 모달) — Day 7은 전체가 결과 보기 버튼 */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {isLastDay ? (
            <button
              type="button"
              onClick={async () => {
                markRebalanceOpened();
                if (!todayConfirmed) {
                  const pid = Number(localStorage.getItem('participationId'));
                  const result = await confirmAllocation(pid, allocation, activeTags, memo);
                  if (result) {
                    setConfirmedAlloc({ ...allocation });
                    setTodayConfirmed(true);
                    setEquity(Math.floor(result.portfolio_value));
                    setTotalReturn(result.return_rate);
                    notifySeasonExpIfFinalized(result);
                  }
                }
                navigate('/dashboard/simulator/season/result');
              }}
              className={`bg-[#1A237E] text-white rounded-2xl shadow-sm hover:shadow-lg hover:bg-[#1f2a8c] transition-all flex items-center justify-center gap-4 p-12 md:p-16 cursor-pointer min-h-[300px] group ${
                !todayConfirmed && !hasOpenedToday ? 'animate-navy-blink' : ''
              }`}
            >
              <span className="text-3xl md:text-5xl font-black tracking-tight">결과 보기</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { markRebalanceOpened(); setRebalancingOpen(true); }}
              className={`bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:border-[#1A237E]/60 hover:shadow-md transition-all text-left cursor-pointer group ${
                !todayConfirmed && !hasOpenedToday ? 'animate-navy-blink' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-xl font-black tracking-tight text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined">pie_chart</span>
                  포트폴리오 리밸런싱
                </h2>
                {todayConfirmed ? (
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    오늘 매매 확정 완료
                  </span>
                ) : (
                  <span className="bg-[#1A237E]/10 text-[#1A237E] text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 group-hover:bg-[#1A237E] group-hover:text-white transition-colors">
                    리밸런싱하기
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-around gap-4 sm:gap-6 bg-surface-container-low p-4 sm:p-6 rounded-xl border border-outline-variant/30">
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-on-surface-variant text-sm">현재 배분</span>
                  <DonutPlaceholder allocation={confirmedAlloc} assets={scenario.assets} />
                </div>
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <div className="text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">현재 총 자산</span>
                    <span className="text-2xl md:text-3xl font-black tracking-tight text-on-surface whitespace-nowrap">₩{equity.toLocaleString()}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">남은 현금 (원화)</span>
                    <span className="text-base font-bold tracking-tight text-on-surface whitespace-nowrap">
                      {confirmedLeftoverRatio % 1 === 0 ? confirmedLeftoverRatio : confirmedLeftoverRatio.toFixed(2)}% · ₩{confirmedLeftoverWon.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {rebalancingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pb-24 md:pb-4" onClick={() => setRebalancingOpen(false)}>
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] md:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-surface-container-lowest flex items-center justify-between p-6 border-b border-outline-variant/30">
              <h2 className="text-xl font-black tracking-tight text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined">pie_chart</span>
                포트폴리오 리밸런싱
              </h2>
              <button
                onClick={() => setRebalancingOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container-low transition-colors"
                aria-label="닫기"
              >
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <section className="p-6">
              <div className="flex flex-wrap xl:flex-nowrap items-center justify-around gap-4 sm:gap-6 mb-8 bg-surface-container-low p-4 sm:p-6 rounded-xl border border-outline-variant/30 overflow-hidden">
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-on-surface-variant text-sm">현재 배분</span>
                  <DonutPlaceholder allocation={confirmedAlloc} assets={scenario.assets} />
                </div>
                <div className="flex flex-col items-center gap-2 order-first xl:order-none w-full xl:w-auto xl:flex-1 xl:min-w-0">
                  <div className="text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">현재 총 자산</span>
                    <span className="text-2xl md:text-3xl font-black tracking-tight text-on-surface whitespace-nowrap">₩{equity.toLocaleString()}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">남은 현금 (원화)</span>
                    <span className="text-base font-bold tracking-tight text-on-surface whitespace-nowrap">
                      {leftoverRatio % 1 === 0 ? leftoverRatio : leftoverRatio.toFixed(2)}% · ₩{leftoverWon.toLocaleString()}
                    </span>
                  </div>
                  {!totalRatioOk && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-red-100 text-red-700">합계 초과: {totalRatio}%</span>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-[#1A237E] text-sm">변경 후 배분</span>
                  <DonutPlaceholder allocation={allocation} assets={scenario.assets} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-y-4">
                {scenario.assets.map((key) => {
                const meta = ASSET_META[key] ?? { label: key, color: '#94a3b8', accent: '' };
                const ratio = allocation[key] ?? 0;
                const currentRatio = confirmedAlloc[key] ?? 0;
                const won = Math.round((ratio * equity) / 100);
                const delta = ratio - currentRatio;
                const ratioDisplay = Number.isInteger(ratio) ? ratio : Number(ratio.toFixed(2));
                const history = prices[key] ?? [];
                const todayPrice = history[todayIdx0] ?? 1;
                const yesterdayPrice = todayIdx0 > 0 ? (history[todayIdx0 - 1] ?? todayPrice) : todayPrice;
                const dailyPct = yesterdayPrice !== 0 ? ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100 : 0;
                const tradeWon = Math.round((Math.abs(delta) * equity) / 100);
                const isSell = delta < 0;
                const isBuy = delta > 0;
                const realizedPL = isSell && todayPrice !== 0 && todayIdx0 > 0
                  ? Math.round(tradeWon * (todayPrice - yesterdayPrice) / todayPrice)
                  : 0;
                const setRatio = (next: number) => updateRatio(key, next);
                const stepRatio = (d: number) => updateRatio(key, Math.max(0, Math.min(100, Math.round(ratio) + d)));
                const setWon = (nextWon: number) => setRatio((Math.max(0, Math.min(equity, nextWon || 0)) / equity) * 100);

                return (
                  <div key={key} className="flex flex-col gap-3 p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/40">
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-bold text-on-surface text-sm flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                        <span className="truncate">{meta.label}</span>
                      </label>
                      <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                        <span className="text-on-surface-variant font-semibold">
                          {currentRatio}% → <span className="font-bold text-on-surface">{ratioDisplay}%</span>
                        </span>
                        <span className="text-on-surface/40">·</span>
                        <span className="text-sm font-bold tracking-tight text-on-surface">₩{won.toLocaleString()}</span>
                      </div>
                    </div>
                    <input type="range" min={0} max={100} value={ratio}
                      onChange={(e) => setRatio(Number(e.target.value))}
                      className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                      style={{ accentColor: meta.color }}
                      disabled={todayConfirmed} />
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-surface-container rounded-md px-2 py-1 flex-shrink-0">
                        <input type="number" min={0} max={100} step={0.01}
                          value={ratioDisplay === 0 ? '' : ratioDisplay} placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setRatio(e.target.value === '' ? 0 : Number(e.target.value))}
                          disabled={todayConfirmed}
                          className="w-12 bg-transparent text-center text-sm font-bold text-on-surface focus:outline-none placeholder:text-on-surface-variant/40" />
                        <span className="text-xs font-semibold text-on-surface-variant">%</span>
                      </div>
                      <span className="text-on-surface-variant text-xs">·</span>
                      <div className="flex items-center bg-surface-container rounded-md px-2 py-1 flex-1 min-w-0">
                        <span className="text-xs font-semibold text-on-surface-variant flex-shrink-0">₩</span>
                        <input type="number" min={0} step={1}
                          value={won === 0 ? '' : won} placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setWon(e.target.value === '' ? 0 : Number(e.target.value))}
                          disabled={todayConfirmed}
                          className="w-full bg-transparent text-right text-sm font-bold text-on-surface focus:outline-none min-w-0 placeholder:text-on-surface-variant/40" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => stepRatio(-STEP_PCT)} disabled={ratio <= 0 || todayConfirmed}
                        className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-bold border border-blue-200 hover:bg-blue-100 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed">
                        −{STEP_PCT}%
                      </button>
                      <button type="button" onClick={() => stepRatio(STEP_PCT)} disabled={ratio >= 100 || todayConfirmed}
                        className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-bold border border-red-200 hover:bg-red-100 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed">
                        +{STEP_PCT}%
                      </button>
                    </div>
                    {delta !== 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/30">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${isBuy ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          <span className="material-symbols-outlined text-[14px]">{isBuy ? 'arrow_upward' : 'arrow_downward'}</span>
                          {isBuy ? '매수' : '매도'} {Math.abs(delta)}% · ₩{tradeWon.toLocaleString()}
                        </span>
                        {isSell && todayIdx0 > 0 && (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${realizedPL > 0 ? 'text-emerald-700' : realizedPL < 0 ? 'text-red-700' : 'text-on-surface-variant'}`}>
                            <span className="material-symbols-outlined text-[14px]">{realizedPL > 0 ? 'trending_up' : realizedPL < 0 ? 'trending_down' : 'remove'}</span>
                            실현 {dailyPct > 0 ? '+' : ''}{dailyPct.toFixed(2)}% ({realizedPL > 0 ? '+' : ''}₩{realizedPL.toLocaleString()})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. 투자 판단 근거 */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-on-surface">투자 판단 근거</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">선택사항</span>
              </div>
              {(activeTags.length > 0 || memo.length > 0) && (
                <button onClick={() => { setActiveTags([]); setMemo(''); }}
                  className="text-xs font-semibold text-on-surface-variant hover:text-[#1A237E] transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">refresh</span>초기화
                </button>
              )}
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
              태그로 빠르게 선택하거나 직접 입력해도 됩니다. 작성하지 않아도 매매는 확정됩니다.
            </p>
            <div className="mb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                태그로 선택 {activeTags.length > 0 && `· ${activeTags.length}개 선택됨`}
              </span>
              <div className="flex flex-wrap gap-2">
                {REASON_TAGS.map((tag) => {
                  const isActive = activeTags.includes(tag);
                  return (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors border ${isActive ? 'bg-[#1A237E]/10 text-[#1A237E] border-[#1A237E]/30' : 'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:bg-surface-variant'}`}>
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">직접 입력</span>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200}
                placeholder="자유롭게 적어주세요. 시즌 종료 후 복기에 사용됩니다. (예: 연준 매파 발언으로 채권 비중 확대)"
                className="w-full h-24 bg-surface-container-low border-none rounded-xl p-4 text-sm text-on-surface focus:ring-2 focus:ring-[#1A237E] resize-none placeholder-outline" />
              <div className="flex justify-end mt-1">
                <span className="text-[10px] font-semibold text-on-surface-variant">{memo.length} / 200</span>
              </div>
            </div>
          </section>

          {/* 6. 확정 버튼 */}
          <div className="flex flex-col items-center mt-4">
            <div className="flex gap-3 w-full md:w-auto">
              <button
                disabled={isLastDay ? (!todayConfirmed && !totalRatioOk) : (!totalRatioOk || todayConfirmed)}
                onClick={handleConfirm}
                className="flex-1 md:flex-none bg-[#1A237E] text-white font-bold text-lg px-8 py-4 rounded-xl shadow-sm hover:shadow-md hover:bg-[#1A237E]/90 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isLastDay ? '결과 보기' : (todayConfirmed ? '오늘 매매 확정 완료' : '오늘의 매매 확정하기')}
              </button>
              {/* [DEV ONLY] 다음 일차 강제 이동 버튼 - 테스트 전용, 배포 전 제거 필요 */}
              <button
                onClick={async () => {
                  const pid = Number(localStorage.getItem('participationId'));
                  const result = await devAdvanceDay(pid); // DEV ONLY
                  if (result) window.location.reload();
                }}
                className="px-4 py-4 rounded-xl border-2 border-dashed border-orange-400 text-orange-500 font-bold text-sm hover:bg-orange-50 transition-colors"
                title="[DEV] 다음 일차로 이동"
              >
                <span className="material-symbols-outlined text-[20px] align-middle">skip_next</span>
              </button>
              {/* [DEV ONLY] 시나리오 진행 전체 초기화 버튼 - 테스트 전용, 배포 전 제거 필요 */}
              <button
                onClick={async () => {
                  if (!confirm('[DEV] 모든 회차 진행을 초기화하시겠습니까?\nDB에 기록된 모든 배분 내역이 삭제됩니다.')) return;
                  const result = await devResetParticipation(); // DEV ONLY
                  if (result) {
                    localStorage.removeItem('participationId');
                    navigate('/dashboard/simulator');
                  }
                }}
                className="px-4 py-4 rounded-xl border-2 border-dashed border-red-400 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors"
                title="[DEV] 시나리오 초기화"
              >
                <span className="material-symbols-outlined text-[20px] align-middle">restart_alt</span>
              </button>
            </div>
            <span className="text-on-surface-variant text-xs mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">info</span>
              {isLastDay ? '마지막 날 · 클릭 시 시즌 종료 후 결과 페이지로 이동' : '오늘 1회 가능 · 자정 자동 정산'}
            </span>
          </div>
          </div>
        </div>
      )}

      {selectedAsset && (
        <AssetDetailModal
          assetKey={selectedAsset}
          label={ASSET_META[selectedAsset]?.label ?? selectedAsset}
          color={ASSET_META[selectedAsset]?.color ?? '#94a3b8'}
          history={prices[selectedAsset] ?? []}
          todayIdx={todayIdx0}
          scenarioStage={scenario.stage}
          onClose={() => setSelectedAsset(null)}
        />
      )}
      {selectedMacroIdx !== null && macroItems[selectedMacroIdx] && (
        <MacroDetailModal macro={macroItems[selectedMacroIdx]} todayIdx={todayIdx0} scenarioStage={scenario.stage} onClose={() => setSelectedMacroIdx(null)} />
      )}
      {selectedSignalIdx !== null && currentDayNews[selectedSignalIdx] && (
        <NewsDetailModal signal={currentDayNews[selectedSignalIdx]} onClose={() => setSelectedSignalIdx(null)} />
      )}
    </div>
  );
}

function DonutPlaceholder({ allocation, assets }: { allocation: Record<string, number>; assets: string[] }) {
  const segments = assets
    .map((key) => ({ pct: allocation[key] ?? 0, color: ASSET_META[key]?.color ?? '#94a3b8' }))
    .filter((s) => s.pct > 0);
  const totalAlloc = assets.reduce((sum, key) => sum + (allocation[key] ?? 0), 0);
  const leftover = Math.max(0, 100 - totalAlloc);
  if (leftover > 0) segments.push({ pct: leftover, color: '#cbd5e1' });
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  return (
    <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 flex-shrink-0">
      <svg viewBox="-50 -50 100 100" className="w-full h-full -rotate-90">
        <circle r={radius} cx={0} cy={0} fill="none" stroke="#e4e1ea" strokeWidth={16} />
        {segments.map((s, i) => {
          const dashLen = (s.pct / 100) * circumference;
          const dashOffset = -(cumulative / 100) * circumference;
          cumulative += s.pct;
          return <circle key={i} r={radius} cx={0} cy={0} fill="none" stroke={s.color} strokeWidth={16} strokeDasharray={`${dashLen} ${circumference}`} strokeDashoffset={dashOffset} className="transition-all duration-300" />;
        })}
      </svg>
    </div>
  );
}

function AssetDetailModal({ assetKey: _assetKey, label, color, history, todayIdx, scenarioStage, onClose }: {
  assetKey: string; label: string; color: string; history: number[]; todayIdx: number; scenarioStage: number; onClose: () => void;
}) {
  const W = 600, H = 280, padX = 50, padY = 30;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const knownHistory = history.slice(0, todayIdx + 1);
  const min = Math.min(...knownHistory); const max = Math.max(...knownHistory);
  const range = max - min || 1;
  const yMin = min - range * 0.25; const yMax = max + range * 0.25; const yRange = yMax - yMin;
  const xStep = innerW / (TOTAL_DAYS - 1);
  const points = knownHistory.map((v, i) => ({ x: padX + i * xStep, y: padY + (1 - (v - yMin) / yRange) * innerH, value: v }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const currentPrice = knownHistory[todayIdx] ?? knownHistory[knownHistory.length - 1] ?? 0;
  const startPrice = knownHistory[0] ?? 1;
  const cumulPct = ((currentPrice - startPrice) / startPrice) * 100;
  const isUp = cumulPct > 0;
  const yTicks = Array.from({ length: 5 }, (_, i) => { const t = yMin + (yRange * i) / 4; return { value: t, y: padY + (1 - (t - yMin) / yRange) * innerH }; });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pb-24 md:pb-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] md:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
            <div>
              <h2 className="text-2xl font-black tracking-tight text-on-surface">{label}</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-0.5">시즌 #{scenarioStage} · Day 1 ~ Day {todayIdx + 1}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-low transition-colors" aria-label="닫기">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="px-6 pt-5 flex items-end gap-3">
          <span className="text-4xl font-black tracking-tight text-on-surface">{currentPrice.toFixed(2)}</span>
          <span className={`text-sm font-bold px-2 py-1 rounded mb-1 ${isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{isUp ? '+' : ''}{cumulPct.toFixed(2)}%</span>
          <span className="text-xs text-on-surface-variant mb-2">시즌 시작 대비</span>
        </div>
        <div className="px-6 py-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {yTicks.map((t, i) => <g key={i}><line x1={padX} x2={W - padX} y1={t.y} y2={t.y} stroke="#e4e1ea" strokeWidth="1" strokeDasharray="2,3" /></g>)}
            {Array.from({ length: TOTAL_DAYS }, (_, i) => <text key={i} x={padX + i * xStep} y={H - 8} textAnchor="middle" fontSize="11" fill="#767683" fontWeight="600">D{i + 1}</text>)}
            <line x1={padX + todayIdx * xStep} x2={padX + todayIdx * xStep} y1={padY} y2={H - padY} stroke="#1A237E" strokeWidth="1.5" strokeDasharray="4,4" />
            <text x={padX + todayIdx * xStep} y={padY - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1A237E">오늘</text>
            <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={5} fill="white" stroke={color} strokeWidth="2.5" />
                <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1b1b21">{p.value.toFixed(2)}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-3">일별 가격</h3>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: TOTAL_DAYS }, (_, i) => {
              const isFuture = i > todayIdx;
              const v = isFuture ? null : history[i]; const prev = isFuture ? null : history[i - 1];
              const dailyPct = v != null && prev != null ? ((v - prev) / prev) * 100 : null;
              const isToday = i === todayIdx;
              return (
                <div key={i} className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${isToday ? 'border-[#1A237E] bg-[#1A237E]/5' : isFuture ? 'border-outline-variant/20 bg-surface-container-low/50 opacity-50' : 'border-outline-variant/30'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">D{i + 1}</span>
                  <span className="text-sm font-black tracking-tight text-on-surface">{isFuture || v == null ? '—' : v.toFixed(2)}</span>
                  {dailyPct != null && !isFuture && (
                    <span className={`text-[10px] font-bold ${dailyPct > 0.01 ? 'text-emerald-700' : dailyPct < -0.01 ? 'text-red-700' : 'text-slate-500'}`}>
                      {dailyPct > 0 ? '+' : ''}{dailyPct.toFixed(2)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MacroDetailModal({ macro, todayIdx, scenarioStage, onClose }: {
  macro: { label: string; history: number[]; stroke: string; formatValue: (v: number) => string }; todayIdx: number; scenarioStage: number; onClose: () => void;
}) {
  const W = 600, H = 280, padX = 50, padY = 30;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const { history } = macro;
  const min = Math.min(...history); const max = Math.max(...history);
  const range = max - min || 1;
  const yMin = min - range * 0.25; const yMax = max + range * 0.25; const yRange = yMax - yMin;
  const xStep = innerW / (TOTAL_DAYS - 1);
  const points = history.map((v, i) => ({ x: padX + i * xStep, y: padY + (1 - (v - yMin) / yRange) * innerH, value: v }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const currentValue = history[todayIdx] ?? history[history.length - 1] ?? 0;
  const startValue = history[0] ?? 1;
  const cumulDelta = currentValue - startValue;
  const cumulPct = ((currentValue - startValue) / startValue) * 100;
  const isVix = macro.label === 'VIX';
  const isFx = macro.label === '환율 (USD/KRW)';
  const isUp = cumulDelta > 0;
  const yTicks = Array.from({ length: 5 }, (_, i) => { const t = yMin + (yRange * i) / 4; return { value: t, y: padY + (1 - (t - yMin) / yRange) * innerH }; });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pb-24 md:pb-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] md:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: macro.stroke }} />
            <div>
              <h2 className="text-2xl font-black tracking-tight text-on-surface">{macro.label}</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-0.5">시즌 #{scenarioStage} · Day 1 ~ Day {todayIdx + 1}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-low transition-colors" aria-label="닫기">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="px-6 pt-5 flex items-end gap-3">
          <span className="text-4xl font-black tracking-tight text-on-surface">{macro.formatValue(currentValue)}</span>
          <span className={`text-sm font-bold px-2 py-1 rounded mb-1 ${isUp ? 'bg-red-100 text-red-700' : cumulDelta < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {isUp ? '+' : ''}{isVix ? cumulDelta.toFixed(1) : isFx ? `${cumulPct.toFixed(2)}%` : macro.label === 'CPI' ? `${cumulDelta.toFixed(1)}%` : `${cumulDelta.toFixed(2)}%`}
          </span>
          <span className="text-xs text-on-surface-variant mb-2">시즌 시작 대비</span>
        </div>
        <div className="px-6 py-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {yTicks.map((t, i) => <g key={i}><line x1={padX} x2={W - padX} y1={t.y} y2={t.y} stroke="#e4e1ea" strokeWidth="1" strokeDasharray="2,3" /></g>)}
            {Array.from({ length: TOTAL_DAYS }, (_, i) => <text key={i} x={padX + i * xStep} y={H - 8} textAnchor="middle" fontSize="11" fill="#767683" fontWeight="600">D{i + 1}</text>)}
            <line x1={padX + todayIdx * xStep} x2={padX + todayIdx * xStep} y1={padY} y2={H - padY} stroke="#1A237E" strokeWidth="1.5" strokeDasharray="4,4" />
            <text x={padX + todayIdx * xStep} y={padY - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1A237E">오늘</text>
            <path d={linePath} fill="none" stroke={macro.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={5} fill="white" stroke={macro.stroke} strokeWidth="2.5" />
                <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1b1b21">{macro.formatValue(p.value)}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-3">일별 값</h3>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: TOTAL_DAYS }, (_, i) => {
              const v = history[i]; const prev = history[i - 1];
              const dailyDelta = v != null && prev != null ? v - prev : null;
              const dailyPct = isFx && v != null && prev != null && prev !== 0 ? ((v - prev) / prev) * 100 : null;
              const isToday = i === todayIdx; const isFuture = v == null;
              const deltaNum = isFx ? dailyPct : dailyDelta;
              const deltaStr = isFx && dailyPct != null
                ? `${dailyPct > 0 ? '+' : ''}${dailyPct.toFixed(2)}%`
                : dailyDelta != null
                  ? `${dailyDelta > 0 ? '+' : ''}${macro.label === 'CPI' ? dailyDelta.toFixed(1) : dailyDelta.toFixed(2)}${isVix ? '' : '%'}`
                  : null;
              return (
                <div key={i} className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${isToday ? 'border-[#1A237E] bg-[#1A237E]/5' : isFuture ? 'border-outline-variant/20 bg-surface-container-low/50 opacity-50' : 'border-outline-variant/30'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">D{i + 1}</span>
                  <span className="text-sm font-black tracking-tight text-on-surface">{isFuture ? '—' : macro.formatValue(v)}</span>
                  {deltaStr != null && !isFuture && (
                    <span className={`text-[10px] font-bold ${deltaNum != null && deltaNum > 0 ? 'text-red-700' : deltaNum != null && deltaNum < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {deltaStr}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsDetailModal({ signal, onClose }: { signal: DayNews; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pb-24 md:pb-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] md:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 rounded text-xs font-bold tracking-widest bg-surface-container-high text-on-surface-variant">#{signal.news_type}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-low transition-colors flex-shrink-0" aria-label="닫기">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="p-6 flex flex-col gap-6">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface leading-snug">{signal.title}</h2>
          {signal.description && <p className="text-base text-on-surface leading-relaxed whitespace-pre-line">{signal.description}</p>}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex gap-3">
            <span className="material-symbols-outlined text-[#1A237E] mt-0.5">tips_and_updates</span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-on-surface">투자 판단 팁</span>
              <p className="text-xs text-on-surface-variant font-bold leading-relaxed whitespace-pre-line">
                {signal.hint
                  ? signal.hint
                  : '이 뉴스가 어떤 자산에 영향을 줄지 거시지표 차트와 함께 비교해보세요. 모든 뉴스가 신호는 아닙니다 — 노이즈일 가능성도 염두에 두세요.'}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[#1A237E] text-white font-bold text-sm hover:bg-[#1A237E]/90 transition-colors">확인</button>
        </div>
      </div>
    </div>
  );
}
