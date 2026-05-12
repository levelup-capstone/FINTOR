import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchParticipation, type ParticipationData } from './simulatorApi';

const TOTAL_DAYS = 7;

const ASSET_META: Record<string, { label: string; color: string }> = {
  cash:           { label: '현금',     color: '#059669' },
  dollar:         { label: '달러',     color: '#16a34a' },
  bonds:          { label: '채권',     color: '#a855f7' },
  'gov-bonds':    { label: '국채',     color: '#7c3aed' },
  tips:           { label: 'TIPS',     color: '#6d28d9' },
  gold:           { label: '금',       color: '#eab308' },
  'bluechip-stock': { label: '우량주', color: '#1A237E' },
  'growth-stock': { label: '성장주',   color: '#dc2626' },
  'dividend-stock': { label: '배당주', color: '#0891b2' },
  stocks:         { label: '주식',     color: '#2563eb' },
  nasdaq:         { label: '나스닥',   color: '#3b82f6' },
  emerging:       { label: '신흥국',   color: '#0d9488' },
  coin:           { label: '코인',     color: '#f97316' },
  bitcoin:        { label: '비트코인', color: '#f59e0b' },
  reits:          { label: '리츠',     color: '#06b6d4' },
  commodities:    { label: '원자재',   color: '#84cc16' },
  oil:            { label: '원유',     color: '#78716c' },
  agriculture:    { label: '농산물',   color: '#65a30d' },
};

const fmtPct = (v: number | null | undefined, sign = true) => {
  if (v == null) return '--';
  const prefix = sign && v > 0 ? '+' : '';
  return `${prefix}${v.toFixed(1)}%`;
};

type DaySummary = {
  day: number;
  returnRate: number | null;
  portfolioValue: number | null;
  status: 'done' | 'today' | 'pending' | 'locked';
};

export function SimulatorCalendar() {
  const navigate = useNavigate();
  const [pData, setPData] = useState<ParticipationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);

  useEffect(() => {
    const pid = localStorage.getItem('participationId');
    if (!pid) { setLoading(false); return; }
    fetchParticipation(Number(pid)).then((d) => {
      setPData(d);
      if (d) setSelectedDay(Math.min(d.today_index, TOTAL_DAYS));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="w-full bg-surface-container-lowest rounded-2xl h-36 animate-pulse" />
      </div>
    );
  }

  if (!pData) {
    return (
      <div className="flex flex-col gap-8">
        <button
          onClick={() => navigate('/dashboard/simulator/season')}
          className="self-start inline-flex items-center gap-1.5 px-3 py-2 -ml-3 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-[#1A237E] hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          시뮬레이터로 돌아가기
        </button>
        <div className="text-center text-on-surface-variant py-12">진행 중인 시뮬레이션이 없습니다.</div>
      </div>
    );
  }

  const { scenario, today_index, current_value, total_return, initial_cash, allocations, news_by_day, prices } = pData;

  // Day 요약 빌드
  const daySummaries: DaySummary[] = Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const day = i + 1;
    const alloc = allocations.find((a) => a.day_index === day);
    let status: DaySummary['status'];
    if (alloc) {
      status = day === today_index ? 'today' : 'done';
    } else if (day === today_index) {
      status = 'today';
    } else if (day < today_index) {
      status = 'pending';
    } else {
      status = 'locked';
    }
    return {
      day,
      returnRate: alloc?.return_rate ?? null,
      portfolioValue: alloc?.portfolio_value != null ? Math.floor(alloc.portfolio_value) : null,
      status,
    };
  });

  const summary = daySummaries.find((d) => d.day === selectedDay)!;
  const selectedAlloc = allocations.find((a) => a.day_index === selectedDay);
  const prevAlloc = allocations.find((a) => a.day_index === selectedDay - 1);
  const selectedNews = news_by_day[selectedDay] ?? [];

  // 자산 배분 변화 테이블
  type AllocationRow = { asset: string; label: string; color: string; start: number; end: number; realizedPL: number | null };
  const allocRows: AllocationRow[] = scenario.assets.map((asset) => {
    const meta = ASSET_META[asset] ?? { label: asset, color: '#94a3b8' };
    const start = prevAlloc?.allocations[asset] ?? 0;
    const end = selectedAlloc?.allocations[asset] ?? 0;
    const delta = end - start;
    let realizedPL: number | null = null;
    if (selectedDay > 1 && prevAlloc && selectedAlloc?.portfolio_value != null && delta < 0) {
      const priceArr = prices[asset] ?? [];
      const todayPrice = priceArr[selectedDay - 1] ?? 0;
      const yesterdayPrice = priceArr[selectedDay - 2] ?? todayPrice;
      if (todayPrice && yesterdayPrice) {
        const tradeWon = (Math.abs(delta) / 100) * selectedAlloc.portfolio_value;
        realizedPL = Math.round(tradeWon * (todayPrice - yesterdayPrice) / todayPrice);
      }
    }
    return { asset, label: meta.label, color: meta.color, start, end, realizedPL };
  });
  const totalRealizedPL = allocRows.reduce((s, r) => s + (r.realizedPL ?? 0), 0);
  const hasAnyRealized = allocRows.some((r) => r.realizedPL !== null);

  const isUp = total_return >= 0;

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
            시즌 #{scenario.stage} · {scenario.theme}
          </h1>
          <p className="text-sm font-medium text-on-surface-variant">{scenario.name}</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="bg-surface-container p-4 rounded-xl flex flex-col items-center flex-1 md:min-w-[120px]">
            <span className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">총 수익률</span>
            <span className={`text-2xl font-black tracking-tight ${isUp ? 'text-emerald-700' : 'text-red-700'}`}>
              {isUp ? '+' : ''}{total_return.toFixed(2)}%
            </span>
          </div>
          <div className="bg-surface-container p-4 rounded-xl flex flex-col items-center flex-1 md:min-w-[120px]">
            <span className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">총 자산</span>
            <span className="text-2xl font-black tracking-tight text-[#1A237E]">
              ₩{Math.floor(current_value).toLocaleString()}
            </span>
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
          {daySummaries.map((d) => {
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
                    d.returnRate == null
                      ? 'text-on-surface-variant'
                      : d.returnRate > 0
                      ? 'text-emerald-700'
                      : d.returnRate < 0
                      ? 'text-red-700'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {fmtPct(d.returnRate)}
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
              {summary.portfolioValue != null
                ? `₩${summary.portfolioValue.toLocaleString()}`
                : selectedDay === today_index && !selectedAlloc
                ? `오늘의 매매 확정 이전`
                : '--'}
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 ${
                summary.returnRate == null
                  ? 'bg-surface-container text-on-surface-variant'
                  : summary.returnRate >= 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                <span className="material-symbols-outlined text-[14px]">
                  {summary.returnRate == null ? 'remove' : summary.returnRate >= 0 ? 'trending_up' : 'trending_down'}
                </span>
                일일 {fmtPct(summary.returnRate)}
              </span>
              <span className="bg-surface-container text-on-surface-variant text-xs font-semibold px-3 py-1 rounded-full">
                누적 {fmtPct(summary.returnRate)}
              </span>
            </div>
          </div>

          {/* 전략 태그 + 메모 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6">
            <h3 className="text-[16px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">label</span>
              전략 태그
              <span className="ml-auto text-[10px] font-semibold text-on-surface-variant/70 normal-case tracking-normal">
                Day {selectedDay} 기록
              </span>
            </h3>
            {(selectedAlloc?.tags ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-5">
                {(selectedAlloc!.tags).map((tag: string) => (
                  <span key={tag} className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-[#1A237E]/10 text-[#1A237E] border-[#1A237E]/30">
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
              <span className="material-symbols-outlined text-on-surface-variant/60 mb-1 block" style={{ fontVariationSettings: '"FILL" 1' }}>
                format_quote
              </span>
              {selectedAlloc?.memo ? (
                <p className="text-sm text-on-surface-variant italic leading-relaxed">{selectedAlloc.memo}</p>
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
            {!selectedAlloc ? (
              <div className="text-center text-on-surface-variant py-8">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">lock</span>
                <p className="text-sm">이 날의 배분 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* 도넛 비교 */}
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  {selectedDay > 1 && prevAlloc ? (
                    <>
                      <DonutFromAllocation
                        rows={allocRows.map((r) => ({ ratio: r.start, color: r.color }))}
                        label="시작"
                      />
                      <span className="material-symbols-outlined text-outline-variant text-2xl">arrow_forward</span>
                    </>
                  ) : null}
                  <DonutFromAllocation
                    rows={allocRows.map((r) => ({ ratio: r.end, color: r.color }))}
                    label="종료"
                    emphasis
                  />
                </div>

                {/* 변화 테이블 */}
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-on-surface-variant text-xs">
                      <th className="pb-2 text-left font-semibold">자산군</th>
                      {selectedDay > 1 && prevAlloc && <th className="pb-2 text-right font-semibold w-12">시작</th>}
                      <th className="pb-2 text-right font-semibold w-12">종료</th>
                      {selectedDay > 1 && prevAlloc && <th className="pb-2 text-right font-semibold w-14">변화</th>}
                      {hasAnyRealized && <th className="pb-2 text-right font-semibold w-24">실현 손익</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 text-on-surface">
                    {allocRows
                      .map((r) => {
                        const delta = r.end - r.start;
                        return (
                          <tr key={r.asset}>
                            <td className="py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                                <span className="text-sm font-medium truncate">{r.label}</span>
                              </div>
                            </td>
                            {selectedDay > 1 && prevAlloc && (
                              <td className="py-2 text-right text-sm tabular-nums">{r.start}%</td>
                            )}
                            <td className="py-2 text-right text-sm font-semibold tabular-nums">{r.end}%</td>
                            {selectedDay > 1 && prevAlloc && (
                              <td className={`py-2 text-right text-sm font-bold tabular-nums ${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-700' : 'text-on-surface-variant'}`}>
                                {delta > 0 ? '+' : ''}{delta}%
                              </td>
                            )}
                            {hasAnyRealized && (
                              <td className={`py-2 text-right text-sm font-bold tabular-nums ${
                                r.realizedPL == null
                                  ? 'text-on-surface-variant/40'
                                  : r.realizedPL > 0
                                  ? 'text-emerald-700'
                                  : r.realizedPL < 0
                                  ? 'text-red-700'
                                  : 'text-on-surface-variant'
                              }`}>
                                {r.realizedPL == null ? '—' : `${r.realizedPL > 0 ? '+' : ''}₩${r.realizedPL.toLocaleString()}`}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                  {hasAnyRealized && (
                    <tfoot>
                      <tr className="border-t-2 border-outline-variant/30 text-xs">
                        <td colSpan={selectedDay > 1 && prevAlloc ? 4 : 2} className="pt-2 text-right text-on-surface-variant font-bold uppercase tracking-widest">합계</td>
                        <td className={`pt-2 text-right text-sm font-black tabular-nums ${totalRealizedPL > 0 ? 'text-emerald-700' : totalRealizedPL < 0 ? 'text-red-700' : 'text-on-surface-variant'}`}>
                          {totalRealizedPL > 0 ? '+' : ''}₩{totalRealizedPL.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* 그날 본 뉴스 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6">
            <h3 className="text-[16px] font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">newspaper</span>
              Day {selectedDay} 뉴스
            </h3>
            {selectedNews.length === 0 ? (
              <div className="text-center text-on-surface-variant/60 py-6 text-sm">이 날의 뉴스가 없습니다.</div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                {selectedNews.map((n, i) => (
                  <div
                    key={i}
                    className="min-w-[260px] max-w-[260px] bg-surface-container-low rounded-xl border border-outline-variant/30 p-4 snap-start hover:shadow-md transition-shadow cursor-pointer relative flex-shrink-0"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                      #{n.news_type}
                    </span>
                    <h4 className="font-bold text-on-surface text-sm mb-2 line-clamp-2 pr-12">{n.title}</h4>
                    {n.description && (
                      <p className="text-xs text-on-surface-variant line-clamp-2">{n.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

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
