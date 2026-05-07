import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

const TOTAL_DAYS = 7;
const TODAY_INDEX = 2; // D3 (0-based)

type DaySummary = {
  day: number;
  dailyReturn: number | null; // null이면 미래
  cumulativeReturn: number | null;
  equity: number | null;
  status: 'done' | 'today' | 'pending' | 'locked';
};

const DAY_SUMMARIES: DaySummary[] = [
  { day: 1, dailyReturn: 1.2,  cumulativeReturn: 1.2,  equity: 10_120_000, status: 'done' },
  { day: 2, dailyReturn: -0.5, cumulativeReturn: 0.7,  equity: 10_069_000, status: 'done' },
  { day: 3, dailyReturn: 2.8,  cumulativeReturn: 14.2, equity: 12_450_000, status: 'today' },
  { day: 4, dailyReturn: 0.1,  cumulativeReturn: null, equity: null,        status: 'pending' },
  { day: 5, dailyReturn: null, cumulativeReturn: null, equity: null,        status: 'locked' },
  { day: 6, dailyReturn: null, cumulativeReturn: null, equity: null,        status: 'locked' },
  { day: 7, dailyReturn: null, cumulativeReturn: null, equity: null,        status: 'locked' },
];

type AllocationRow = { asset: string; color: string; start: number; end: number };

// Day 3 기준 변경 전/후 자산 배분 (mock)
const ALLOCATIONS_DAY3: AllocationRow[] = [
  { asset: '예적금',  color: '#60a5fa', start: 10, end: 5  },
  { asset: '달러',    color: '#16a34a', start: 5,  end: 0  },
  { asset: '채권',    color: '#a855f7', start: 30, end: 20 },
  { asset: '금',      color: '#eab308', start: 5,  end: 10 },
  { asset: '우량주',  color: '#1A237E', start: 30, end: 40 },
  { asset: '성장주',  color: '#dc2626', start: 10, end: 15 },
  { asset: 'ETF',     color: '#3b82f6', start: 10, end: 10 },
  { asset: '코인',    color: '#f97316', start: 0,  end: 0  },
];

type Trade = { asset: string; type: 'BUY' | 'SELL'; price: number; quantity: number };
const TRADES_DAY3: Trade[] = [
  { asset: '우량주', type: 'BUY',  price: 175_500, quantity: 100 },
  { asset: '성장주', type: 'BUY',  price: 410_200, quantity: 50  },
  { asset: '채권',   type: 'SELL', price: 92_100,  quantity: 200 },
  { asset: '달러',   type: 'SELL', price: 195_000, quantity: 50  },
];

type DayNews = {
  title: string;
  summary: string;
  topic: string;
};
const NEWS_DAY3: DayNews[] = [
  { title: '예상치 상회한 CPI에 기술주 급등', summary: '인플레이션이 예상보다 약간 더 진정되어 성장 부문의 랠리를 촉발했습니다.', topic: '거시', sentiment: '호재' },
  { title: '금리 인하 기대감에 국채 수익률 하락', summary: '오전 경제 지표 발표 이후 10년물 수익률이 4.2% 아래로 떨어졌습니다.', topic: '금리', sentiment: '악재' },
  { title: '반도체 지수 사상 최고치 경신', summary: 'AI 수요가 하드웨어 제조 부문의 성과를 계속해서 주도하고 있습니다.', topic: '기업', sentiment: '호재' },
  { title: '무역 우려 속 유럽 증시 혼조 마감', summary: '투자자들이 지역 데이터와 글로벌 기술주 모멘텀을 저울질하면서 Stoxx 600 지수는 보합세를 보였습니다.', topic: '글로벌', sentiment: '중립' },
  { title: '지정학적 긴장 고조로 방산주 강세', summary: '글로벌 분쟁 우려가 커지면서 방위산업 관련 주식이 상승 압력을 받고 있습니다.', topic: '리스크', sentiment: '악재' },
];

// 과거 날짜용 mock fallback (localStorage 데이터가 없으면 사용)
const MOCK_JOURNALS: Record<number, { tags: string[]; memo: string }> = {
  1: { tags: ['#금리인상_우려', '#안전자산선호'], memo: 'CPI 예상치 상회로 안전 비중을 늘림.' },
  2: { tags: ['#리스크 관리'], memo: '매파 발언으로 채권/예적금 비중 확대.' },
  3: { tags: ['#금리인하_지연', '#기술주랠리'], memo: '기술주 페이크 반등 의심으로 채권 비중 확대.' },
};

const fmtPct = (v: number | null, sign = true) => {
  if (v == null) return '--';
  const prefix = sign && v > 0 ? '+' : '';
  return `${prefix}${v.toFixed(1)}%`;
};

export function SimulatorCalendar() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<number>(TODAY_INDEX + 1);
  const summary = DAY_SUMMARIES.find((d) => d.day === selectedDay)!;
  const [journal, setJournal] = useState<{ tags: string[]; memo: string }>({ tags: [], memo: '' });

  // 선택된 날짜의 태그/메모 로드 (localStorage 우선, 없으면 mock)
  useEffect(() => {
    let loaded: { tags: string[]; memo: string } | null = null;
    try {
      const raw = localStorage.getItem(`fintor_journal_d${selectedDay}`);
      if (raw) loaded = JSON.parse(raw);
    } catch {}
    setJournal(loaded ?? MOCK_JOURNALS[selectedDay] ?? { tags: [], memo: '' });
  }, [selectedDay]);

  return (
    <div className="flex flex-col gap-8">
      {/* 0. 뒤로 가기 */}
      <button
        onClick={() => navigate('/dashboard/simulator/season')}
        className="self-start inline-flex items-center gap-1.5 px-3 py-2 -ml-3 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-[#1A237E] hover:bg-surface-container-low transition-colors active:scale-95"
        aria-label="시뮬레이터로 돌아가기"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        시뮬레이터로 돌아가기
      </button>

      {/* 1. 시즌 요약 배너 */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface mb-1">
            시즌 #1 · 고금리 장기화
          </h1>
          <p className="text-sm font-medium text-on-surface-variant">2026.04.30 ~ 2026.05.06</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="bg-surface-container p-4 rounded-xl flex flex-col items-center flex-1 md:min-w-[120px]">
            <span className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">총 수익률</span>
            <span className="text-2xl font-black tracking-tight text-emerald-700">+14.2%</span>
          </div>
          <div className="bg-surface-container p-4 rounded-xl flex flex-col items-center flex-1 md:min-w-[120px]">
            <span className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">순위</span>
            <span className="text-2xl font-black tracking-tight text-[#1A237E]">#42</span>
          </div>
        </div>
      </section>

      {/* 2. 7일 캘린더 스트립 */}
      <section>
        <div className="flex justify-between items-center mb-3 px-1">
          <h2 className="text-15px font-bold text-on-surface">주간 타임라인</h2>
          <span className="text-xs text-on-surface-variant font-semibold">Day{selectedDay} 선택됨</span>
        </div>
        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {DAY_SUMMARIES.map((d) => {
            const isSelected = d.day === selectedDay;
            const isToday = d.status === 'today';
            const isLocked = d.status === 'locked';
            const isPending = d.status === 'pending';
            const isDone = d.status === 'done';

            return (
              <button
                key={d.day}
                onClick={() => !isLocked && setSelectedDay(d.day)}
                disabled={isLocked}
                className={`relative bg-surface-container-lowest rounded-2xl shadow-sm border p-3 md:p-4 flex flex-col items-center gap-2 min-w-0 transition-all ${
                  isSelected
                    ? 'border-2 border-[#1A237E] shadow-md scale-105 z-10'
                    : isLocked
                    ? 'border-outline-variant/30 opacity-50 cursor-not-allowed'
                    : 'border-outline-variant/30 hover:bg-surface-container-low cursor-pointer'
                }`}
              >
                <span className={`text-[12px] font-bold uppercase tracking-widest ${isSelected ? 'text-[#1A237E]' : 'text-on-surface-variant'}`}>
                  Day{d.day}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    d.dailyReturn == null
                      ? 'text-on-surface-variant'
                      : d.dailyReturn > 0
                      ? 'text-emerald-700'
                      : d.dailyReturn < 0
                      ? 'text-red-700'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {fmtPct(d.dailyReturn)}
                </span>
                <div className="mt-auto pt-2 border-t border-outline-variant/30 w-full flex justify-center text-[#1A237E]">
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={isToday ? { fontVariationSettings: '"FILL" 1' } : undefined}
                  >
                    {isToday ? 'push_pin' : isDone ? 'check_circle' : isPending ? 'hourglass_empty' : 'lock'}
                  </span>
                </div>
                {isSelected && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface-container-lowest border-r-2 border-b-2 border-[#1A237E] rotate-45 hidden lg:block" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. 선택 날짜 상세 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:mt-2">
        {/* 좌측: 평가액 + 전략 태그 + 메모 */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* 평가액 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6">
            <h3 className="text-[14px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              Day {selectedDay} 자산
            </h3>
            <div className="text-3xl md:text-4xl font-black tracking-tight text-on-surface mb-3 break-all">
              {summary.equity != null ? `₩${summary.equity.toLocaleString()}` : '--'}
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                일일 {fmtPct(summary.dailyReturn)}
              </span>
              <span className="bg-surface-container text-on-surface-variant text-xs font-semibold px-3 py-1 rounded-full">
                누적 {fmtPct(summary.cumulativeReturn)}
              </span>
            </div>
          </div>

          {/* 전략 태그 + 메모 (시뮬레이터에서 입력한 내용 — 읽기 전용) */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6">
            <h3 className="text-[16px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">label</span>
              전략 태그
              <span className="ml-auto text-[10px] font-semibold text-on-surface-variant/70 normal-case tracking-normal">
                Day {selectedDay} 기록
              </span>
            </h3>

            {journal.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-5">
                {journal.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-[#1A237E]/10 text-[#1A237E] border-[#1A237E]/30"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mb-5 px-3 py-2 rounded-lg bg-surface-container-low text-xs text-on-surface-variant text-center">
                선택된 태그 없음
              </div>
            )}

            <div className="bg-surface-container rounded-xl p-4 border-l-4 border-[#1A237E]">
              <span
                className="material-symbols-outlined text-on-surface-variant/60 mb-1 block"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                format_quote
              </span>
              {journal.memo ? (
                <p className="text-sm text-on-surface-variant italic leading-relaxed">{journal.memo}</p>
              ) : (
                <p className="text-sm text-on-surface-variant/60 italic leading-relaxed">메모를 작성하지 않았습니다.</p>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 자산 배분 + 거래 내역 */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* 자산 배분 변화 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6">
            <h3 className="text-[25px] font-bold uppercase tracking-widest text-on-surface-variant mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">pie_chart</span>
              자산 배분 변화
            </h3>
            <div className="flex flex-col gap-6">
              {/* 도넛 비교 (가로 가운데 정렬) */}
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <DonutFromAllocation
                  rows={ALLOCATIONS_DAY3.map((r) => ({ ratio: r.start, color: r.color }))}
                  label="시작"
                />
                <span className="material-symbols-outlined text-outline-variant text-2xl">arrow_forward</span>
                <DonutFromAllocation
                  rows={ALLOCATIONS_DAY3.map((r) => ({ ratio: r.end, color: r.color }))}
                  label="종료"
                  emphasis
                />
              </div>

              {/* 변화 테이블 — 풀폭, 스크롤 없음 */}
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-on-surface-variant text-xs">
                    <th className="pb-2 text-left font-semibold">자산군</th>
                    <th className="pb-2 text-right font-semibold w-14">시작</th>
                    <th className="pb-2 text-right font-semibold w-14">종료</th>
                    <th className="pb-2 text-right font-semibold w-16">변화</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-on-surface">
                  {ALLOCATIONS_DAY3.map((r) => {
                    const delta = r.end - r.start;
                    return (
                      <tr key={r.asset}>
                        <td className="py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                            <span className="text-sm font-medium truncate">{r.asset}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right text-sm tabular-nums">{r.start}%</td>
                        <td className="py-2 text-right text-sm font-semibold tabular-nums">{r.end}%</td>
                        <td
                          className={`py-2 text-right text-sm font-bold tabular-nums ${
                            delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-700' : 'text-on-surface-variant'
                          }`}
                        >
                          {delta > 0 ? '+' : ''}
                          {delta}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 자동 거래 내역 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="p-5 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low">
              <h3 className="text-[16px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                거래 내역
              </h3>
              <span className="bg-[#1A237E]/10 text-[#1A237E] text-xs font-bold px-2 py-1 rounded-md">
                {TRADES_DAY3.length}건의 거래
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-surface-container-lowest">
                  <tr className="text-on-surface-variant text-xs border-b border-outline-variant/30">
                    <th className="px-5 py-3 text-left font-semibold">자산</th>
                    <th className="px-5 py-3 text-left font-semibold">종류</th>
                    <th className="px-5 py-3 text-right font-semibold">가격</th>
                    <th className="px-5 py-3 text-right font-semibold">수량</th>
                    <th className="px-5 py-3 text-right font-semibold">총액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-on-surface">
                  {TRADES_DAY3.map((t, i) => {
                    const total = t.price * t.quantity;
                    return (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-5 py-3 font-bold">{t.asset}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              t.type === 'BUY' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                            }`}
                          >
                            {t.type === 'BUY' ? '매수' : '매도'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">₩{t.price.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">{t.quantity}</td>
                        <td className="px-5 py-3 text-right font-semibold">₩{total.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 그날 본 뉴스 */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6">
        <h3 className="text-[16px] font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">newspaper</span>
          Day {selectedDay}에 본 뉴스 {NEWS_DAY3.length}개
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
          {NEWS_DAY3.map((n, i) => (
            <div
              key={i}
              className="min-w-[260px] max-w-[260px] bg-surface-container-low rounded-xl border border-outline-variant/30 p-4 snap-start hover:shadow-md transition-shadow cursor-pointer relative flex-shrink-0"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                #{n.topic}
              </span>
              <h4 className="font-bold text-on-surface text-sm mb-2 line-clamp-2 pr-12">{n.title}</h4>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// 도넛 (자산 비율 합산 100% 가정)
function DonutFromAllocation({
  rows,
  label,
  emphasis = false,
}: {
  rows: { ratio: number; color: string }[];
  label: string;
  emphasis?: boolean;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  const total = rows.reduce((s, r) => s + r.ratio, 0) || 1;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0">
        <svg viewBox="-50 -50 100 100" className="w-full h-full -rotate-90">
          <circle r={radius} cx={0} cy={0} fill="none" stroke="#e4e1ea" strokeWidth={14} />
          {rows.map((r, i) => {
            if (r.ratio <= 0) return null;
            const dashLen = (r.ratio / total) * circumference;
            const dashOffset = -(cumulative / total) * circumference;
            cumulative += r.ratio;
            return (
              <circle
                key={i}
                r={radius}
                cx={0}
                cy={0}
                fill="none"
                stroke={r.color}
                strokeWidth={14}
                strokeDasharray={`${dashLen} ${circumference}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
      </div>
      <span className={`text-xs font-bold ${emphasis ? 'text-[#1A237E]' : 'text-on-surface-variant'}`}>
        {label}
      </span>
    </div>
  );
}
