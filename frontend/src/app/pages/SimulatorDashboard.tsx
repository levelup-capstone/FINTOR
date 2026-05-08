import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

type AssetKey = 'deposit' | 'krw' | 'bonds' | 'gold' | 'bluechip-stock' | 'growth-stock' | 'etf' | 'coin';

const ASSETS: { key: AssetKey; label: string; color: string; accent: string }[] = [
  { key: 'deposit',         label: '예적금',     color: '#059669', accent: 'accent-emerald-600' },
  { key: 'krw',             label: '달러 (USD)', color: '#16a34a', accent: 'accent-green-600' },
  { key: 'bonds',           label: '채권',       color: '#a855f7', accent: 'accent-purple-500' },
  { key: 'gold',            label: '금',         color: '#eab308', accent: 'accent-yellow-500' },
  { key: 'bluechip-stock',  label: '우량주',     color: '#1A237E', accent: 'accent-[#1A237E]' },
  { key: 'growth-stock',    label: '성장주',     color: '#dc2626', accent: 'accent-red-600' },
  { key: 'etf',             label: 'ETF',       color: '#3b82f6', accent: 'accent-blue-500' },
  { key: 'coin',            label: '코인',       color: '#f97316', accent: 'accent-orange-500' },
];

const INITIAL_ALLOC: Record<AssetKey, number> = {
  deposit: 30, krw: 10, bonds: 20, gold: 5,
  'bluechip-stock': 25, 'growth-stock': 10, etf: 0, coin: 0,
};

type MacroKey = 'cpi' | 'rate' | 'fx' | 'vix';

const MACRO: {
  key: MacroKey;
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
  path: string;
  stroke: string;
  history: number[];
  formatValue: (v: number) => string;
}[] = [
  {
    key: 'cpi',
    label: 'CPI',
    value: '4.2%',
    delta: '+0.3%',
    deltaColor: 'bg-red-100 text-red-700',
    path: 'M0 30 L20 25 L40 28 L60 15 L80 20 L100 10',
    stroke: '#dc2626',
    history: [4.0, 4.1, 4.2],
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'rate',
    label: '기준금리',
    value: '5.5%',
    delta: '0.0%',
    deltaColor: 'bg-slate-100 text-slate-600',
    path: 'M0 20 L100 20',
    stroke: '#64748b',
    history: [5.5, 5.5, 5.5],
    formatValue: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: 'fx',
    label: '환율 (USD/KRW)',
    value: '1,342',
    delta: '+12',
    deltaColor: 'bg-red-100 text-red-700',
    path: 'M0 35 L20 30 L40 32 L60 20 L80 15 L100 5',
    stroke: '#dc2626',
    history: [1320, 1330, 1342],
    formatValue: (v) => v.toLocaleString(),
  },
  {
    key: 'vix',
    label: 'VIX',
    value: '24.5',
    delta: '-2.1',
    deltaColor: 'bg-emerald-100 text-emerald-700',
    path: 'M0 10 L20 25 L40 15 L60 30 L80 20 L100 35',
    stroke: '#059669',
    history: [27.5, 26.6, 24.5],
    formatValue: (v) => v.toFixed(1),
  },
];

// 자산별 D1~D3 가격 추이 (시작 100 기준 시뮬레이션 값)
const ASSET_HISTORY: Record<AssetKey, number[]> = {
  deposit:          [100.0, 100.01, 100.02],
  krw:              [100.5, 101.0,  100.7],
  bonds:            [100.3, 100.8,  100.6],
  gold:             [100.2, 100.5,  100.3],
  'bluechip-stock': [99.5,  98.8,   99.5],
  etf:              [99.0,  98.0,   99.0],
  'growth-stock':   [98.0,  96.5,   99.5],
  coin:             [97.0,  95.0,   99.0],
};

const TODAY_INDEX = 2; // D3 (0-based)
const TOTAL_DAYS = 7;
const EQUITY = 10_234_000; // 현재 총 자산 (mock)
const STEP_PCT = 10; // 비중 조정 버튼 1회당 변경량 (%)

function buildChartPath(history: number[]): string {
  if (history.length < 2) return '';
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const yMin = min - range * 0.2;
  const yMax = max + range * 0.2;
  const yRange = yMax - yMin;
  const xStep = 100 / (TOTAL_DAYS - 1);

  return history
    .map((v, i) => {
      const x = i * xStep;
      const y = 40 - ((v - yMin) / yRange) * 40;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

type Signal = {
  sentiment: '호재' | '중립' | '악재';
  category: string;
  topic: string;
  source: string;
  timeLabel: string;
  title: string;
  description: string;
};

// 내부 sentiment/category 필드는 점수 계산용 (UI에는 노출하지 않음)
// 1-indexed by day (1~7)
const SIGNALS_BY_DAY: Record<number, Signal[]> = {
  1: [
    { sentiment: '악재', category: '거시 신호', topic: '금리', source: '경제일보',  timeLabel: 'Day 1 · 오전',
      title: '4월 CPI 3.5%, 시장 예상치 상회',
      description: '소비자물가지수가 시장 예상치인 3.3%를 웃돌며 인플레이션 압력이 여전함을 보여줬습니다. 금리 인하 기대감이 후퇴하면서 위험자산이 약세를 보였습니다.' },
    { sentiment: '호재', category: '자산 호재', topic: '채권', source: '머니투데이', timeLabel: 'Day 1 · 오전',
      title: '국채 ETF 자금 유입 가속',
      description: '단기 국채 ETF에 기관 자금이 빠르게 유입되며 안전자산 선호 심리가 강해지고 있습니다.' },
    { sentiment: '악재', category: '함정',     topic: '기업', source: '테크인사이트', timeLabel: 'Day 1 · 오후',
      title: 'AI 빅테크 신제품 발표 기대',
      description: '주요 빅테크 기업들이 다음 주 신제품 발표를 앞두고 시장 관심을 모으고 있습니다. 일부 애널리스트는 단기 모멘텀을 점치고 있습니다.' },
    { sentiment: '중립', category: '노이즈',   topic: '연예', source: '데일리스타',   timeLabel: 'Day 1 · 오후',
      title: '인기 가수 콘서트 매진 행렬',
      description: '글로벌 투어를 진행 중인 인기 가수의 국내 콘서트가 전 회차 매진을 기록했습니다.' },
    { sentiment: '중립', category: '노이즈/심리', topic: '시장', source: '시장평론',   timeLabel: 'Day 1 · 마감',
      title: '"이번 주 연준 발언 주목" 시장 평론',
      description: '주요 증권사 리포트는 이번 주 연준 인사 발언이 시장 변동성을 좌우할 것으로 전망했습니다.' },
  ],
  2: [
    { sentiment: '악재', category: '거시 신호', topic: '금리', source: '경제일보',  timeLabel: 'Day 2 · 오전',
      title: '연준 매파 발언, 시장 충격',
      description: '연준 인사들이 잇따라 매파적 발언을 내놓으며 추가 금리 인상 가능성까지 언급되었습니다. 주요 지수가 일제히 하락했습니다.' },
    { sentiment: '호재', category: '자산 호재', topic: '채권', source: '글로벌타임즈', timeLabel: 'Day 2 · 오전',
      title: '단기 채권 수익률 안정세',
      description: '단기물 채권이 매수세 유입으로 안정세를 보이며 안전자산 선호가 이어지고 있습니다.' },
    { sentiment: '악재', category: '자산 악재', topic: '기업', source: '테크인사이트', timeLabel: 'Day 2 · 오후',
      title: '성장주 -3% 약세, 매크로 부담',
      description: '성장주 중심으로 매도세가 강하게 유입되며 코스닥 지수가 약세를 보였습니다.' },
    { sentiment: '중립', category: '노이즈',   topic: '스포츠', source: '스포츠뉴스',   timeLabel: 'Day 2 · 오후',
      title: '국가대표 친선전 승리',
      description: '국가대표 축구팀이 친선전에서 승리하며 팬들의 기대를 모았습니다.' },
    { sentiment: '중립', category: '노이즈/심리', topic: '시장', source: '시장평론',   timeLabel: 'Day 2 · 마감',
      title: '"변동성 확대 국면" 분석 보고서',
      description: '증권가는 단기 변동성이 추가 확대될 가능성에 무게를 두며 보수적 포지셔닝을 권고했습니다.' },
  ],
  3: [
    { sentiment: '악재', category: '거시 신호', topic: '금리', source: '경제일보',     timeLabel: 'Day 3 · 오전',
      title: '연준, 금리 인하 기대감 일축',
      description: '파월 의장은 물가 상승 압력이 여전히 높다며 당분간 현재의 고금리 기조를 유지할 것임을 시사했습니다. 시장의 조기 금리 인하 기대감이 꺾이면서 주요 지수가 하락 마감했습니다.' },
    { sentiment: '호재', category: '자산 호재', topic: '기업', source: '테크인사이트', timeLabel: 'Day 3 · 오전',
      title: '주요 기술주 실적 서프라이즈',
      description: '빅테크 기업들의 1분기 실적이 시장 예상치를 크게 상회하며 성장주 중심의 랠리가 이어지고 있습니다. 특히 AI 관련 투자가 실질적인 매출 증가로 이어지고 있다는 분석입니다.' },
    { sentiment: '중립', category: '노이즈',   topic: '지정학', source: '글로벌타임즈', timeLabel: 'Day 3 · 오후',
      title: '지정학적 긴장감 고조',
      description: '중동 지역의 산발적인 충돌이 이어지며 원유 공급 차질에 대한 우려가 제기되고 있으나, 즉각적인 유가 급등으로는 이어지지 않고 관망세가 짙은 모습입니다.' },
    { sentiment: '악재', category: '함정',     topic: '부동산', source: '머니투데이',  timeLabel: 'Day 3 · 오후',
      title: '상업용 부동산 리스크 재점화',
      description: '지역 은행들의 상업용 부동산 대출 연체율이 상승하며 금융 시스템 불안정성 우려가 다시 고개를 들고 있습니다. 관련 리츠 자산의 변동성에 유의해야 합니다.' },
    { sentiment: '중립', category: '노이즈',   topic: '연예', source: '데일리스타',     timeLabel: 'Day 3 · 오후',
      title: '아이돌 그룹 신곡, 빌보드 진입 화제',
      description: '국내 인기 아이돌 그룹의 신곡이 빌보드 핫100에 진입하며 K-POP의 글로벌 위상을 다시 한 번 입증했습니다. 음악 시장 관계자들의 관심이 집중되고 있습니다.' },
  ],
  4: [],
  5: [],
  6: [],
  7: [],
};

const REASON_TAGS = [
  '#금리인하_지연', '#금리인상_우려', '#실적호조', '#실적부진',
  '#안전자산선호', '#위험자산선호', '#기술주랠리', '#기술주조정',
  '#달러강세', '#원화강세', '#인플레이션우려', '#변동성확대',
  '#차트분석', '#감으로',
];

export function SimulatorDashboard() {
  const navigate = useNavigate();
  // 현재 보유 (확정된 비중)
  const [currentAllocation, setCurrentAllocation] = useState<Record<AssetKey, number>>(INITIAL_ALLOC);
  // 변경 작업 중인 비중
  const [allocation, setAllocation] = useState<Record<AssetKey, number>>(INITIAL_ALLOC);
  const journalKey = `fintor_journal_d${TODAY_INDEX + 1}`;
  // localStorage에서 초기값 로드 (사용자가 이미 작성한 경우 복원)
  const initialJournal = (() => {
    try {
      const raw = localStorage.getItem(journalKey);
      return raw ? (JSON.parse(raw) as { tags: string[]; memo: string }) : null;
    } catch {
      return null;
    }
  })();
  const [memo, setMemo] = useState<string>(initialJournal?.memo ?? '');
  const [activeTags, setActiveTags] = useState<string[]>(initialJournal?.tags ?? []);

  // tags / memo 변경 시 자동 저장
  useEffect(() => {
    try {
      localStorage.setItem(journalKey, JSON.stringify({ tags: activeTags, memo }));
    } catch {}
  }, [activeTags, memo, journalKey]);
  const [selectedAsset, setSelectedAsset] = useState<AssetKey | null>(null);
  const [selectedMacro, setSelectedMacro] = useState<MacroKey | null>(null);
  const [selectedSignalIdx, setSelectedSignalIdx] = useState<number | null>(null);
  // 뉴스 탭에서 보고 있는 Day (1-indexed). 기본값 = 오늘
  const [selectedNewsDay, setSelectedNewsDay] = useState<number>(TODAY_INDEX + 1);
  const currentDayNews = SIGNALS_BY_DAY[selectedNewsDay] ?? [];

  const totalRatioRaw = Object.values(allocation).reduce((sum, n) => sum + n, 0);
  const totalRatio = Math.round(totalRatioRaw * 100) / 100;
  // 100% 초과만 막고, 미달은 자동으로 원화 현금으로 남김
  const totalRatioOk = totalRatio <= 100.01;
  const leftoverRatio = Math.max(0, 100 - totalRatio);
  const leftoverWon = Math.round((leftoverRatio * EQUITY) / 100);

  const updateRatio = (key: AssetKey, value: number) => {
    setAllocation((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 시즌 배너 */}
      <section className="bg-[#1A237E] text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-400 rounded-full opacity-20 blur-3xl pointer-events-none" />
        <div className="flex-1 z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-white text-[#1A237E] font-bold px-2 py-1 rounded-full text-[11px] tracking-widest uppercase">
              SEASON #1
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">고금리 장기화</h1>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="text-sm font-semibold">Day 3 / 7</div>
            <div className="flex-1 max-w-[200px] h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-300 rounded-full" style={{ width: '42.8%' }} />
            </div>
          </div>
        </div>
        <div className="flex gap-6 z-10 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-bold uppercase tracking-widest text-white/70">총 자산</span>
            <span className="text-3xl md:text-4xl font-black tracking-tight">₩10,234,000</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                +2.3%
              </span>
              <span className="text-sm font-semibold text-white/80">Ranking 47th</span>
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
        {MACRO.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedMacro(m.key)}
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
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Day 3 기준</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ASSETS.map((a) => {
            const history = ASSET_HISTORY[a.key];
            const price = history[TODAY_INDEX];
            const prevPrice = history[TODAY_INDEX - 1] ?? price;
            const changePct = ((price - prevPrice) / prevPrice) * 100;
            const isUp = changePct > 0.01;
            const isDown = changePct < -0.01;
            const path = buildChartPath(history);
            const todayX = ((TODAY_INDEX) / (TOTAL_DAYS - 1)) * 100;

            return (
              <button
                key={a.key}
                onClick={() => setSelectedAsset(a.key)}
                className="flex flex-col gap-2 p-3 rounded-xl border border-outline-variant/30 hover:bg-surface-container-low hover:border-[#1A237E]/30 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                  <span className="text-sm font-bold text-on-surface truncate">{a.label}</span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <span className="text-base md:text-lg font-black tracking-tight text-on-surface">
                    {price.toFixed(2)}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                      isUp
                        ? 'bg-emerald-100 text-emerald-700'
                        : isDown
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isUp ? '+' : ''}
                    {changePct.toFixed(1)}%
                  </span>
                </div>
                {/* 미니 차트 */}
                <div className="h-12 w-full mt-1">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                    <path
                      d={path}
                      fill="none"
                      stroke={a.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* 오늘 시점 마커 */}
                    <line
                      x1={todayX}
                      x2={todayX}
                      y1="0"
                      y2="40"
                      stroke="#c6c5d4"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. 오늘의 뉴스 — 전체 폭, 가로 그리드 */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-black tracking-tight text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined">newspaper</span>
            오늘의 뉴스
          </h2>
          <span className="text-xs font-semibold text-on-surface-variant">
            {selectedNewsDay === TODAY_INDEX + 1 ? '오늘' : `Day ${selectedNewsDay}`} · {currentDayNews.length}개
          </span>
        </div>

        {/* Day 1~7 버튼 (오늘 이후는 잠금) */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {Array.from({ length: TOTAL_DAYS }, (_, i) => {
            const day = i + 1;
            const isToday = day === TODAY_INDEX + 1;
            const isLocked = day > TODAY_INDEX + 1;
            const isSelected = day === selectedNewsDay;
            return (
              <button
                key={day}
                onClick={() => !isLocked && setSelectedNewsDay(day)}
                disabled={isLocked}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                  isSelected
                    ? 'bg-[#1A237E] text-white border-[#1A237E]'
                    : isLocked
                    ? 'bg-surface-container-low text-on-surface-variant/40 border-outline-variant/20 cursor-not-allowed'
                    : 'bg-surface-container-high text-on-surface border-outline-variant/30 hover:bg-surface-variant'
                }`}
              >
                Day{day}
                {isToday && (
                  <span
                    className={`text-[9px] font-bold px-1 py-px rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#1A237E]/10 text-[#1A237E]'
                    }`}
                  >
                    오늘
                  </span>
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
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-surface-container-high text-on-surface-variant">
                    #{s.topic}
                  </span>
                  <span className="text-on-surface-variant text-[10px] font-semibold">
                    {s.timeLabel}
                  </span>
                </div>
                <h3 className="font-bold text-on-surface text-sm group-hover:text-[#1A237E] transition-colors line-clamp-3">
                  {s.title}
                </h3>
                <span className="text-[10px] font-semibold text-on-surface-variant/70 mt-auto pt-2 block">
                  {s.source}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 메인 워크스페이스 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 자산 추이 */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* 7. 자산 추이 */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30">
            <h2 className="text-xl font-black tracking-tight text-on-surface mb-4">자산 추이</h2>
            <div className="h-48 w-full relative mt-4">
              <div className="absolute inset-0 border-b border-l border-outline-variant/30" />
              <div className="absolute top-[60%] w-full border-t border-dashed border-outline-variant">
                <span className="absolute -top-4 right-0 text-[10px] font-semibold text-on-surface-variant">₩10M</span>
              </div>
              <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0 60 L16.6 55 L33.3 65 L50 40" fill="none" stroke="#1A237E" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <path d="M50 40 L66.6 45 L83.3 35 L100 20" fill="none" stroke="#c6c5d4" strokeDasharray="4,4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="absolute left-[50%] top-0 bottom-0 border-l-2 border-[#1A237E] border-dashed">
                <div className="absolute -top-6 -left-5 bg-[#1A237E] text-white text-[13px] font-bold px-2 py-0.5 rounded whitespace-nowrap">D-3</div>
                <div className="absolute top-[40%] -left-[5px] w-[10px] h-[10px] bg-white border-2 border-[#1A237E] rounded-full shadow-sm z-10" />
              </div>
              <div className="absolute -bottom-5 w-full flex justify-between text-[13px] font-semibold text-on-surface-variant px-1">
                {['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* 우측: 포트폴리오 리밸런싱 */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* 4. 자산 배분 에디터 */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30">
            <h2 className="text-xl font-black tracking-tight text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined">pie_chart</span>
              포트폴리오 리밸런싱
            </h2>

            {/* 도넛 비교 */}
            <div className="flex flex-wrap xl:flex-nowrap items-center justify-around gap-4 sm:gap-6 mb-8 bg-surface-container-low p-4 sm:p-6 rounded-xl border border-outline-variant/30 overflow-hidden">
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <span className="font-bold text-on-surface-variant text-sm">현재 배분</span>
                <DonutPlaceholder allocation={currentAllocation} />
              </div>
              <div className="flex flex-col items-center gap-2 order-first xl:order-none w-full xl:w-auto xl:flex-1 xl:min-w-0">
                <div className="text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    현재 총 자산
                  </span>
                  <span className="text-2xl md:text-3xl font-black tracking-tight text-on-surface whitespace-nowrap">
                    ₩{EQUITY.toLocaleString()}
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    남은 현금 (원화)
                  </span>
                  <span className="text-base font-bold tracking-tight text-on-surface whitespace-nowrap">
                    {leftoverRatio % 1 === 0 ? leftoverRatio : leftoverRatio.toFixed(2)}% · ₩{leftoverWon.toLocaleString()}
                  </span>
                </div>
                {!totalRatioOk && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-md bg-red-100 text-red-700">
                    합계 초과: {totalRatio}%
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <span className="font-bold text-[#1A237E] text-sm">변경 후 배분</span>
                <DonutPlaceholder allocation={allocation} />
              </div>
            </div>

            {/* 자산별 편집 행 */}
            <div className="grid grid-cols-1 gap-y-4">
              {ASSETS.map((a) => {
                const ratio = allocation[a.key];
                const currentRatio = currentAllocation[a.key];
                const won = Math.round((ratio * EQUITY) / 100);
                const delta = ratio - currentRatio;
                // 표시용: 정수면 그대로, 소수면 최대 2자리까지
                const ratioDisplay = Number.isInteger(ratio) ? ratio : Number(ratio.toFixed(2));

                // 가격 정보 (시즌 시작 D1 vs 오늘)
                const buyPrice = ASSET_HISTORY[a.key][0];
                const todayPrice = ASSET_HISTORY[a.key][TODAY_INDEX];
                const priceChangePct = ((todayPrice - buyPrice) / buyPrice) * 100;

                // 거래 정보
                const tradeWon = Math.round((Math.abs(delta) * EQUITY) / 100);
                const isSell = delta < 0;
                const isBuy = delta > 0;
                // 매도 시 실현 손익 (오늘 매도가 vs 시즌 시작 매수가)
                const realizedPL = isSell ? Math.round(tradeWon * ((todayPrice - buyPrice) / todayPrice)) : 0;

                // 정밀도 손실 없이 그대로 저장 (₩ 입력 시 round-trip 보장)
                const setRatio = (next: number) => {
                  const clamped = Math.max(0, Math.min(100, next));
                  updateRatio(a.key, clamped);
                };
                // 매수/매도 버튼 (정수 스텝)
                const stepRatio = (deltaPct: number) => {
                  const clamped = Math.max(0, Math.min(100, Math.round(ratio) + deltaPct));
                  updateRatio(a.key, clamped);
                };
                const setWon = (nextWon: number) => {
                  const safe = Math.max(0, Math.min(EQUITY, nextWon || 0));
                  setRatio((safe / EQUITY) * 100);
                };

                return (
                  <div
                    key={a.key}
                    className="flex flex-col gap-3 p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/40"
                  >
                    {/* 상단: 라벨 + 변경 전/후 + ₩ */}
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-bold text-on-surface text-sm flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                        <span className="truncate">{a.label}</span>
                      </label>
                      <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                        <span className="text-on-surface-variant font-semibold">
                          {currentRatio}% → <span className="font-bold text-on-surface">{ratioDisplay}%</span>
                        </span>
                        <span className="text-on-surface/40">·</span>
                        <span className="text-sm font-bold tracking-tight text-on-surface">
                          ₩{won.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* 슬라이더 */}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={ratio}
                      onChange={(e) => setRatio(Number(e.target.value))}
                      className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                      style={{ accentColor: a.color }}
                    />

                    {/* 하단: 매도 / 입력 / 매수 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => stepRatio(-STEP_PCT)}
                        disabled={ratio <= 0}
                        className="flex-shrink-0 flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 hover:bg-blue-100 active:scale-95 transition disabled:opacity-40 disabled:hover:bg-blue-50 disabled:cursor-not-allowed min-w-[52px]"
                        aria-label={`${a.label} ${STEP_PCT}% 감소`}
                      >
                        −{STEP_PCT}%
                      </button>

                      <div className="flex-1 flex items-center gap-1.5 min-w-[180px]">
                        <div className="flex items-center bg-surface-container rounded-md px-2 py-1 flex-shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={ratioDisplay === 0 ? '' : ratioDisplay}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setRatio(e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-12 bg-transparent text-center text-sm font-bold text-on-surface focus:outline-none placeholder:text-on-surface-variant/40"
                          />
                          <span className="text-xs font-semibold text-on-surface-variant">%</span>
                        </div>
                        <span className="text-on-surface-variant text-xs">·</span>
                        <div className="flex items-center bg-surface-container rounded-md px-2 py-1 flex-1 min-w-0">
                          <span className="text-xs font-semibold text-on-surface-variant flex-shrink-0">₩</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={won === 0 ? '' : won}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setWon(e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-full bg-transparent text-right text-sm font-bold text-on-surface focus:outline-none min-w-0 placeholder:text-on-surface-variant/40"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => stepRatio(STEP_PCT)}
                        disabled={ratio >= 100}
                        className="flex-shrink-0 flex items-center justify-center px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-200 hover:bg-red-100 active:scale-95 transition disabled:opacity-40 disabled:hover:bg-red-50 disabled:cursor-not-allowed min-w-[52px]"
                        aria-label={`${a.label} ${STEP_PCT}% 증가`}
                      >
                        +{STEP_PCT}%
                      </button>
                    </div>

                    {/* 거래 요약 (변경 있을 때만) */}
                    {delta !== 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/30">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${
                            isBuy
                              ? 'bg-red-50 text-red-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isBuy ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                          {isBuy ? '매수' : '매도'} {Math.abs(delta)}% · ₩{tradeWon.toLocaleString()}
                        </span>
                        {isSell && (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold ${
                              realizedPL > 0
                                ? 'text-emerald-700'
                                : realizedPL < 0
                                ? 'text-red-700'
                                : 'text-on-surface-variant'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {realizedPL > 0 ? 'trending_up' : realizedPL < 0 ? 'trending_down' : 'remove'}
                            </span>
                            실현 {realizedPL > 0 ? '+' : ''}
                            {priceChangePct.toFixed(2)}% ({realizedPL > 0 ? '+' : ''}₩{realizedPL.toLocaleString()})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. 투자 판단 근거 (선택사항) */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-on-surface">투자 판단 근거</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                  선택사항
                </span>
              </div>
              {(activeTags.length > 0 || memo.length > 0) && (
                <button
                  onClick={() => {
                    setActiveTags([]);
                    setMemo('');
                  }}
                  className="text-xs font-semibold text-on-surface-variant hover:text-[#1A237E] transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  초기화
                </button>
              )}
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
              태그로 빠르게 선택하거나 직접 입력해도 됩니다. 작성하지 않아도 매매는 확정됩니다.
            </p>

            {/* 태그 선택 */}
            <div className="mb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                태그로 선택 {activeTags.length > 0 && `· ${activeTags.length}개 선택됨`}
              </span>
              <div className="flex flex-wrap gap-2">
                {REASON_TAGS.map((tag) => {
                  const isActive = activeTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors border ${
                        isActive
                          ? 'bg-[#1A237E]/10 text-[#1A237E] border-[#1A237E]/30'
                          : 'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:bg-surface-variant'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 자유 입력 */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                직접 입력
              </span>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={200}
                placeholder="자유롭게 적어주세요. 시즌 종료 후 복기에 사용됩니다. (예: 연준 매파 발언으로 채권 비중 확대)"
                className="w-full h-24 bg-surface-container-low border-none rounded-xl p-4 text-sm text-on-surface focus:ring-2 focus:ring-[#1A237E] resize-none placeholder-outline"
              />
              <div className="flex justify-end mt-1">
                <span className="text-[10px] font-semibold text-on-surface-variant">
                  {memo.length} / 200
                </span>
              </div>
            </div>
          </section>

          {/* 6. 확정 버튼 */}
          <div className="flex flex-col items-center mt-4">
            <button
              disabled={!totalRatioOk}
              onClick={() => setCurrentAllocation(allocation)}
              className="w-full md:w-auto bg-[#1A237E] text-white font-bold text-lg px-8 py-4 rounded-xl shadow-sm hover:shadow-md hover:bg-[#1A237E]/90 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              오늘의 매매 확정하기
            </button>
            <span className="text-on-surface-variant text-xs mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">info</span>
              오늘 1회 가능 · 자정 자동 정산
            </span>
          </div>
        </div>
      </div>

      {/* 자산 상세 모달 */}
      {selectedAsset && (
        <AssetDetailModal
          assetKey={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}

      {/* 거시지표 상세 모달 */}
      {selectedMacro && (
        <MacroDetailModal
          macroKey={selectedMacro}
          onClose={() => setSelectedMacro(null)}
        />
      )}

      {/* 뉴스 상세 모달 */}
      {selectedSignalIdx !== null && currentDayNews[selectedSignalIdx] && (
        <NewsDetailModal
          signal={currentDayNews[selectedSignalIdx]}
          onClose={() => setSelectedSignalIdx(null)}
        />
      )}
    </div>
  );
}

// 도넛 차트 (SVG 기반, 컨테이너 안에 안전하게 들어감)
function DonutPlaceholder({ allocation }: { allocation: Record<AssetKey, number> }) {
  // 자산별 비중을 ASSETS 순서 + 색상으로 매핑
  const segments = ASSETS
    .map((a) => ({ pct: allocation[a.key], color: a.color }))
    .filter((s) => s.pct > 0);

  // 남은 현금(원화) 비중 — 100 - 합계
  const totalAlloc = ASSETS.reduce((sum, a) => sum + allocation[a.key], 0);
  const leftover = Math.max(0, 100 - totalAlloc);
  if (leftover > 0) {
    segments.push({ pct: leftover, color: '#cbd5e1' }); // 연회색 = 남은 현금
  }

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
          return (
            <circle
              key={i}
              r={radius}
              cx={0}
              cy={0}
              fill="none"
              stroke={s.color}
              strokeWidth={16}
              strokeDasharray={`${dashLen} ${circumference}`}
              strokeDashoffset={dashOffset}
              className="transition-all duration-300"
            />
          );
        })}
      </svg>
    </div>
  );
}

// 자산 상세 모달 (큰 차트 + 일별 가격)
function AssetDetailModal({ assetKey, onClose }: { assetKey: AssetKey; onClose: () => void }) {
  const asset = ASSETS.find((a) => a.key === assetKey)!;
  const history = ASSET_HISTORY[assetKey];
  const todayIdx = TODAY_INDEX;

  // 차트 영역 (SVG 좌표계)
  const W = 600;
  const H = 280;
  const padX = 40;
  const padY = 30;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const yMin = min - range * 0.25;
  const yMax = max + range * 0.25;
  const yRange = yMax - yMin;

  const xStep = innerW / (TOTAL_DAYS - 1);

  const points = history.map((v, i) => ({
    x: padX + i * xStep,
    y: padY + (1 - (v - yMin) / yRange) * innerH,
    value: v,
    day: i + 1,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const currentPrice = history[todayIdx];
  const startPrice = history[0];
  const cumulPct = ((currentPrice - startPrice) / startPrice) * 100;
  const isUp = cumulPct > 0;

  // y축 눈금 (5단계)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const t = yMin + (yRange * i) / 4;
    const y = padY + (1 - (t - yMin) / yRange) * innerH;
    return { value: t, y };
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: asset.color }} />
            <div>
              <h2 className="text-2xl font-black tracking-tight text-on-surface">{asset.label}</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-0.5">
                시즌 #1 · Day 1 ~ Day {todayIdx + 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-low transition-colors"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {/* 가격 요약 */}
        <div className="px-6 pt-5 flex items-end gap-3">
          <span className="text-4xl font-black tracking-tight text-on-surface">{currentPrice.toFixed(2)}</span>
          <span
            className={`text-sm font-bold px-2 py-1 rounded mb-1 ${
              isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {isUp ? '+' : ''}
            {cumulPct.toFixed(2)}%
          </span>
          <span className="text-xs text-on-surface-variant mb-2">시즌 시작 대비</span>
        </div>

        {/* 차트 */}
        <div className="px-6 py-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {/* y축 그리드 */}
            {yTicks.map((t, i) => (
              <g key={i}>
                <line
                  x1={padX}
                  x2={W - padX}
                  y1={t.y}
                  y2={t.y}
                  stroke="#e4e1ea"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
              </g>
            ))}

            {/* x축 라벨 */}
            {Array.from({ length: TOTAL_DAYS }, (_, i) => {
              const x = padX + i * xStep;
              return (
                <text
                  key={i}
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#767683"
                  fontWeight="600"
                >
                  D{i + 1}
                </text>
              );
            })}

            {/* 오늘 시점 점선 */}
            <line
              x1={padX + todayIdx * xStep}
              x2={padX + todayIdx * xStep}
              y1={padY}
              y2={H - padY}
              stroke="#1A237E"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text
              x={padX + todayIdx * xStep}
              y={padY - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#1A237E"
            >
              오늘
            </text>

            {/* 가격 라인 */}
            <path
              d={linePath}
              fill="none"
              stroke={asset.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 데이터 포인트 + 가격 라벨 */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={5} fill="white" stroke={asset.color} strokeWidth="2.5" />
                <text
                  x={p.x}
                  y={p.y - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#1b1b21"
                >
                  {p.value.toFixed(2)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* 일별 가격 테이블 */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-3">일별 가격</h3>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: TOTAL_DAYS }, (_, i) => {
              const v = history[i];
              const prev = history[i - 1];
              const dailyPct = v != null && prev != null ? ((v - prev) / prev) * 100 : null;
              const isToday = i === todayIdx;
              const isFuture = v == null;
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
                    isToday
                      ? 'border-[#1A237E] bg-[#1A237E]/5'
                      : isFuture
                      ? 'border-outline-variant/20 bg-surface-container-low/50 opacity-50'
                      : 'border-outline-variant/30'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    D{i + 1}
                  </span>
                  <span className="text-sm font-black tracking-tight text-on-surface">
                    {isFuture ? '—' : v.toFixed(2)}
                  </span>
                  {dailyPct != null && !isFuture && (
                    <span
                      className={`text-[10px] font-bold ${
                        dailyPct > 0.01 ? 'text-emerald-700' : dailyPct < -0.01 ? 'text-red-700' : 'text-slate-500'
                      }`}
                    >
                      {dailyPct > 0 ? '+' : ''}
                      {dailyPct.toFixed(2)}%
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

// 거시지표 상세 모달 (큰 차트 + 일별 값)
function MacroDetailModal({ macroKey, onClose }: { macroKey: MacroKey; onClose: () => void }) {
  const macro = MACRO.find((m) => m.key === macroKey)!;
  const history = macro.history;
  const todayIdx = TODAY_INDEX;

  const W = 600;
  const H = 280;
  const padX = 50;
  const padY = 30;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const yMin = min - range * 0.25;
  const yMax = max + range * 0.25;
  const yRange = yMax - yMin;

  const xStep = innerW / (TOTAL_DAYS - 1);

  const points = history.map((v, i) => ({
    x: padX + i * xStep,
    y: padY + (1 - (v - yMin) / yRange) * innerH,
    value: v,
    day: i + 1,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const currentValue = history[todayIdx];
  const startValue = history[0];
  const cumulPct = ((currentValue - startValue) / startValue) * 100;
  const isUp = cumulPct > 0;

  // y축 눈금 (5단계)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const t = yMin + (yRange * i) / 4;
    const y = padY + (1 - (t - yMin) / yRange) * innerH;
    return { value: t, y };
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: macro.stroke }} />
            <div>
              <h2 className="text-2xl font-black tracking-tight text-on-surface">{macro.label}</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-0.5">
                시즌 #1 · Day 1 ~ Day {todayIdx + 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-low transition-colors"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {/* 값 요약 */}
        <div className="px-6 pt-5 flex items-end gap-3">
          <span className="text-4xl font-black tracking-tight text-on-surface">
            {macro.formatValue(currentValue)}
          </span>
          <span
            className={`text-sm font-bold px-2 py-1 rounded mb-1 ${
              isUp ? 'bg-red-100 text-red-700' : cumulPct < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isUp ? '+' : ''}
            {cumulPct.toFixed(2)}%
          </span>
          <span className="text-xs text-on-surface-variant mb-2">시즌 시작 대비</span>
        </div>

        {/* 차트 */}
        <div className="px-6 py-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {/* y축 그리드 */}
            {yTicks.map((t, i) => (
              <g key={i}>
                <line
                  x1={padX}
                  x2={W - padX}
                  y1={t.y}
                  y2={t.y}
                  stroke="#e4e1ea"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
                
              </g>
            ))}

            {/* x축 라벨 */}
            {Array.from({ length: TOTAL_DAYS }, (_, i) => {
              const x = padX + i * xStep;
              return (
                <text
                  key={i}
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#767683"
                  fontWeight="600"
                >
                  D{i + 1}
                </text>
              );
            })}

            {/* 오늘 시점 점선 */}
            <line
              x1={padX + todayIdx * xStep}
              x2={padX + todayIdx * xStep}
              y1={padY}
              y2={H - padY}
              stroke="#1A237E"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text
              x={padX + todayIdx * xStep}
              y={padY - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#1A237E"
            >
              오늘
            </text>

            {/* 값 라인 */}
            <path
              d={linePath}
              fill="none"
              stroke={macro.stroke}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 데이터 포인트 + 값 라벨 */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={5} fill="white" stroke={macro.stroke} strokeWidth="2.5" />
                <text
                  x={p.x}
                  y={p.y - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#1b1b21"
                >
                  {macro.formatValue(p.value)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* 일별 값 테이블 */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-3">일별 값</h3>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: TOTAL_DAYS }, (_, i) => {
              const v = history[i];
              const prev = history[i - 1];
              const dailyDelta = v != null && prev != null ? v - prev : null;
              const isToday = i === todayIdx;
              const isFuture = v == null;
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
                    isToday
                      ? 'border-[#1A237E] bg-[#1A237E]/5'
                      : isFuture
                      ? 'border-outline-variant/20 bg-surface-container-low/50 opacity-50'
                      : 'border-outline-variant/30'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    D{i + 1}
                  </span>
                  <span className="text-sm font-black tracking-tight text-on-surface">
                    {isFuture ? '—' : macro.formatValue(v)}
                  </span>
                  {dailyDelta != null && !isFuture && (
                    <span
                      className={`text-[10px] font-bold ${
                        dailyDelta > 0 ? 'text-red-700' : dailyDelta < 0 ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {dailyDelta > 0 ? '+' : ''}
                      {dailyDelta.toFixed(2)}
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

// 뉴스 상세 모달
function NewsDetailModal({
  signal,
  onClose,
}: {
  signal: {
    sentiment: '호재' | '중립' | '악재';
    category: string;
    topic: string;
    source: string;
    timeLabel: string;
    title: string;
    description: string;
  };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 rounded text-xs font-bold tracking-widest bg-surface-container-high text-on-surface-variant">
              #{signal.topic}
            </span>
            <span className="text-on-surface-variant text-xs font-semibold">{signal.source}</span>
            <span className="text-on-surface-variant text-xs font-semibold">· {signal.timeLabel}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-low transition-colors flex-shrink-0"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 flex flex-col gap-6">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface leading-snug">
            {signal.title}
          </h2>

          <p className="text-base text-on-surface leading-relaxed whitespace-pre-line">
            {signal.description}
          </p>

          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex gap-3">
            <span className="material-symbols-outlined text-[#1A237E] mt-0.5">tips_and_updates</span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-on-surface">투자 판단 팁</span>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                이 뉴스가 어떤 자산에 영향을 줄지 거시지표 차트와 함께 비교해보세요. 모든 뉴스가 신호는 아닙니다 — 노이즈일 가능성도 염두에 두세요.
              </p>
            </div>
          </div>
        </div>

        {/* 하단 액션 */}
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#1A237E] text-white font-bold text-sm hover:bg-[#1A237E]/90 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
