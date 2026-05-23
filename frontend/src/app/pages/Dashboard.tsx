import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { fetchParticipation, fetchMyParticipation, type ParticipationData } from "./simulatorApi";
import { fetchQuizStatus } from "./quizApi";

const MAX_EXP = 5000;
const SIMULATOR_TOTAL_DAYS = 7;

type DailyResult = {
  correctCount: number;
  total: number;
  results: boolean[];
  exp: number;
  streak: number;
};

type DayStatus = 'completed' | 'partial' | 'missed' | 'today' | 'future';

export function Dashboard() {
  const navigate = useNavigate();

  // 사용자 정보
  const [nickname, setNickname] = useState<string>('');
  const [level, setLevel] = useState<number | null>(null);
  const [exp, setExp] = useState<number>(0);
  const [riskType, setRiskType] = useState<string | null>(null);

  const riskLabel = riskType ?? null;

  // 일일 퀴즈 상태
  const [dailyQuizResult, setDailyQuizResult] = useState<DailyResult | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [quizAccuracy, setQuizAccuracy] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('loginResult');
    if (raw) {
      try {
        const data = JSON.parse(raw)?.data;
        if (data?.nickname) setNickname(data.nickname);
        const userId = data?.userId;
        if (userId) {
          fetch(`/api/v1/users/${userId}/level`)
            .then((r) => r.json())
            .then((json) => {
              if (json.success) {
                setLevel(json.data.level);
                setExp(json.data.exp);
                setRiskType(json.data.riskType ?? null);
              }
            })
            .catch(() => {});
        }
      } catch {}
    }
    fetchQuizStatus().then((s) => {
      if (s) {
        setQuizAccuracy(s.accuracy);
        setStreak(s.streak);
        if (s.today_done && s.today_completion) {
          const c = s.today_completion;
          const exp = c.correct_count * 10 + (c.correct_count === c.total ? 20 : 0);
          setDailyQuizResult({ correctCount: c.correct_count, total: c.total, results: c.results, exp, streak: s.streak });
        }
      }
    });
  }, []);

  // ─── 실시간 인기 뉴스 ─────────────────────────────────────────────────
  type PopularNewsItem = {
    id: number;
    title: string;
    description?: string;
    reason?: string;
    category: string;
    sentiment: string;
    tag?: string;
    link: string;
    pub_date: string;
    view_count: number;
  };
  const [popularNews, setPopularNews] = useState<PopularNewsItem[]>([]);
  const [popularNewsLoading, setPopularNewsLoading] = useState(true);

  useEffect(() => {
    const fetchPopular = () => {
      fetch('/api/v1/market/news/popular')
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setPopularNews(json.data ?? []);
        })
        .catch(() => {})
        .finally(() => setPopularNewsLoading(false));
    };
    fetchPopular();
    const id = setInterval(fetchPopular, 60_000);
    return () => clearInterval(id);
  }, []);

  const formatTimeAgo = (pubDateStr: string): string => {
    const pub = new Date(pubDateStr);
    if (isNaN(pub.getTime())) return '';
    const diffMin = Math.floor((Date.now() - pub.getTime()) / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}시간 전`;
    return `${Math.floor(diffHr / 24)}일 전`;
  };

  const handleNewsClick = (newsId: number, link: string) => {
    fetch(`/api/v1/market/news/${newsId}/view`, { method: 'POST' }).catch(() => {});
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const getSentimentClass = (sentiment: string): string => {
    switch (sentiment) {
      case '호재': return 'bg-emerald-100 text-emerald-700';
      case '악재': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  // ─── 시뮬레이터 (오늘의 시나리오) ──────────────────────────────────────
  const [pData, setPData] = useState<ParticipationData | null>(null);
  const [pLoading, setPLoading] = useState(true);

  useEffect(() => {
    const load = async (id: number) => {
      const d = await fetchParticipation(id);
      if (d) setPData(d);
      setPLoading(false);
    };
    const pid = localStorage.getItem('participationId');
    if (pid) {
      load(Number(pid));
    } else {
      fetchMyParticipation().then((r) => {
        if (r) {
          localStorage.setItem('participationId', String(r.participation_id));
          load(r.participation_id);
        } else {
          setPLoading(false);
        }
      });
    }
  }, []);

  // 시뮬레이터 표시 상태: 참여 전 / 오늘 미완료 / 오늘 완료 / 시즌 종료
  type SimState = 'none' | 'today_pending' | 'today_done' | 'finalized';
  const simState: SimState = !pData
    ? 'none'
    : pData.is_finalized
    ? 'finalized'
    : pData.allocations.some((a) => a.day_index === pData.today_index)
    ? 'today_done'
    : 'today_pending';

  // 오늘 완료 시 표시할 결과 값
  const todayAlloc = pData?.allocations.find((a) => a.day_index === pData.today_index);
  const todayValue = todayAlloc?.portfolio_value ?? null;
  const todayReturn = todayAlloc?.return_rate ?? null;

  // 주간 학습 활동 (mock)
  const weeklyActivity: { day: string; status: DayStatus }[] = [
    { day: '월', status: 'completed' },
    { day: '화', status: 'completed' },
    { day: '수', status: 'completed' },
    { day: '목', status: 'completed' },
    { day: '금', status: 'completed' },
    { day: '토', status: 'today' },
    { day: '일', status: 'future' },
  ];
  const completedDays = weeklyActivity.filter((d) => d.status === 'completed').length;
  const remainingDays = weeklyActivity.filter((d) => d.status === 'future' || d.status === 'today').length;

  // streak 다음 milestone 까지
  const nextMilestone = streak < 10 ? 10 : streak < 30 ? 30 : streak < 100 ? 100 : streak + 30;
  const milestoneRemaining = Math.max(0, nextMilestone - streak);

  // ─── 시장 지수 (기존 유지) ────────────────────────────────────────────────
  type IndexItem = { price: number; change_rate: number; change_value: number; source: string };
  const [marketData, setMarketData] = useState<Record<string, IndexItem> | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState(false);
  const [marketUpdatedAt, setMarketUpdatedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('major');

  const fetchMarket = async () => {
    setMarketLoading(true);
    setMarketError(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch('/api/v1/market/indices', { signal: controller.signal });
      const json = await res.json();
      if (json.success) {
        setMarketData(json.data);
        setMarketUpdatedAt(json.updated_at ?? null);
      } else {
        setMarketError(true);
      }
    } catch (e) {
      console.error('시장 지수 조회 실패:', e);
      setMarketError(true);
    } finally {
      clearTimeout(timeoutId);
      setMarketLoading(false);
    }
  };

  useEffect(() => { fetchMarket(); }, []);

  const formatPrice = (key: string, price: number): string => {
    if (key === 'BTC_KRW') return `${(price / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만`;
    if (['USD_KRW', 'JPY_KRW', 'EUR_KRW'].includes(key)) return price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUpdatedAt = (iso: string): string => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000 / 60);
    if (diff < 1) return '방금 전';
    return `${diff}분 전`;
  };

  const INDEX_LABEL: Record<string, string> = {
    KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', VKOSPI: 'VKOSPI',
    KRX200IT: 'KRX IT', KRXHEALTH: 'KRX 헬스케어', BBIG: 'BBIG',
    SP500: 'S&P 500', NASDAQ100: 'NASDAQ 100', DOW30: '다우 30',
    SOX: '반도체 (SOX)', NBI: 'NBI', FANGPLUS: 'FANG+', VIX: 'VIX', US10Y: '미국 10년물',
    NIKKEI225: '니케이 225', HANSENG: '항셍', SSE: '상해종합', EUROSTOXX50: '유로스톡스 50',
    USD_KRW: 'USD/KRW', JPY_KRW: 'JPY/KRW', EUR_KRW: 'EUR/KRW',
    DXY: '달러 인덱스', USD_JPY: 'USD/JPY', EUR_USD: 'EUR/USD',
    WTI: 'WTI 원유', GOLD: '금', SILVER: '은', COPPER: '구리', NATGAS: '천연가스',
    BTC_KRW: '비트코인',
  };

  const CATEGORIES = [
    { key: 'major',     label: '주요지수',   keys: ['SP500','NASDAQ100','KOSPI','KOSDAQ','BTC_KRW','USD_KRW','JPY_KRW'] },
    { key: 'domestic',  label: '국내',       keys: ['KOSPI','KOSDAQ','VKOSPI','KRX200IT','KRXHEALTH','BBIG'] },
    { key: 'us',        label: '미국',       keys: ['SP500','NASDAQ100','DOW30','SOX','NBI','FANGPLUS','VIX','US10Y'] },
    { key: 'asia',      label: '아시아·유럽', keys: ['NIKKEI225','HANSENG','SSE','EUROSTOXX50'] },
    { key: 'fx',        label: '환율',       keys: ['USD_KRW','JPY_KRW','EUR_KRW','DXY','USD_JPY','EUR_USD'] },
    { key: 'commodity', label: '원자재',     keys: ['WTI','GOLD','SILVER','COPPER','NATGAS'] },
    { key: 'crypto',    label: '암호화폐',   keys: ['BTC_KRW'] },
  ];

  const todayDone = !!dailyQuizResult;

  // 최장 streak (mock; 추후 localStorage 또는 백엔드 연동)
  const maxStreak = Math.max(streak, 12);

  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto w-full">

      <div className="flex justify-between items-end pb-3 border-b border-outline-variant/30 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#1A237E]">
              안녕하세요,{' '}
              {riskLabel && (
                <span className="font-black">{riskLabel} 투자자 </span>
              )}
              {nickname || '회원'}님 👋
            </h1>
          </div>
          <div className="bg-orange-50 text-amber-700 px-4 py-2.5 rounded-full flex items-center gap-2 shadow-sm border border-orange-200">
            <span
              className="material-symbols-outlined text-orange-500 text-[22px]"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              local_fire_department
            </span>
            <span className="font-bold text-sm md:text-base tabular-nums">
              {streak}일 연속 · 새로운 기록까지 {milestoneRemaining}일
            </span>
          </div>
        </div>

      {/* ─── 상단: LEVEL & XP 바 (기존 컴포넌트 유지) ─────────────────────────── */}
      <section className="w-full bg-slate-100/50 dark:bg-slate-900/50 p-6 md:p-8 rounded-xl border border-surface-container-low shadow-sm">
        <div className="space-y-3">
          <div className="flex justify-between px-1 items-baseline">
            <span className="text-xl md:text-3xl font-black text-[#1A237E] dark:text-indigo-300 font-headline uppercase tracking-tighter italic drop-shadow-sm">
              {level !== null ? `LEVEL ${level}` : 'LEVEL —'}
            </span>
            <span className="text-[9px] md:text-[10px] font-bold text-slate-600 dark:text-slate-400 tracking-wider uppercase">
              XP {exp.toLocaleString()} / {MAX_EXP.toLocaleString()}
            </span>
          </div>
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#1A237E] via-[#7C4DFF] to-[#D500F9] rounded-full transition-all duration-500"
              style={{ width: `${Math.min((exp / MAX_EXP) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
          <button
            onClick={() => navigate('/dashboard/simulator')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-outline-variant/30 rounded-lg text-[9px] md:text-[11px] font-bold text-[#1A237E] dark:text-indigo-300 hover:bg-surface-container-low transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">edit_note</span>
            시뮬레이터로 경험치 쌓기
          </button>
          <button
            onClick={() => navigate('/dashboard/quiz')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-outline-variant/30 rounded-lg text-[9px] md:text-[11px] font-bold text-[#1A237E] dark:text-indigo-300 hover:bg-surface-container-low transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">quiz</span>
            퀴즈로 경험치 쌓기
          </button>
        </div>
      </section>

      {/* ─── 섹션 1: 오늘의 학습 미션 ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 카드 A — 시뮬레이터 (오늘의 시나리오) */}
          {(() => {
            const route =
              simState === 'none'
                ? '/dashboard/simulator'
                : simState === 'finalized'
                ? '/dashboard/simulator/season/result'
                : simState === 'today_done'
                ? '/dashboard/simulator/season/calendar'
                : '/dashboard/simulator/season';
            const badge =
              simState === 'none'
                ? '참여 전'
                : simState === 'finalized'
                ? '시즌 종료'
                : simState === 'today_done'
                ? `완료 · Day ${pData!.today_index}/${SIMULATOR_TOTAL_DAYS}`
                : `오늘 미완료 · Day ${pData!.today_index}/${SIMULATOR_TOTAL_DAYS}`;
            const badgeClass =
              simState === 'today_done'
                ? 'bg-emerald-50 text-emerald-700'
                : simState === 'none'
                ? 'bg-surface-container-high text-on-surface-variant'
                : 'bg-[#1A237E]/10 text-[#1A237E]';
            const cta =
              simState === 'none'
                ? '시뮬레이터 시작하기'
                : simState === 'finalized'
                ? '결과 확인하기'
                : simState === 'today_done'
                ? '오늘의 결과 다시 보기'
                : '오늘의 시나리오 풀기';
            const progressPct = pData
              ? Math.min((pData.today_index / SIMULATOR_TOTAL_DAYS) * 100, 100)
              : 0;
            const isUp = todayReturn != null ? todayReturn >= 0 : true;

            return (
              <button
                type="button"
                onClick={() => navigate(route)}
                className="text-left bg-surface-container-lowest rounded-2xl p-6 flex flex-col justify-between border border-outline-variant/30 hover:border-[#1A237E]/40 hover:shadow-md transition-all min-h-[280px] cursor-pointer"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-[#1A237E]">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>
                        sports_esports
                      </span>
                      <h3 className="text-xl font-black tracking-tight">오늘의 시뮬레이션</h3>
                    </div>
                    <span className={`text-xs font-bold tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap ${badgeClass}`}>
                      {badge}
                    </span>
                  </div>

                  {pLoading ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-5 bg-surface-container-low rounded w-2/3" />
                      <div className="h-2 bg-surface-container-low rounded-full" />
                      <div className="h-4 bg-surface-container-low rounded w-1/2" />
                    </div>
                  ) : simState === 'none' ? (
                    <div>
                      <p className="font-bold text-base text-on-surface">오늘의 시나리오가 열렸습니다</p>
                      <p className="text-xs text-on-surface-variant mt-1">새로운 시나리오를 확인하고 투자하세요!</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-base text-on-surface">시나리오: {pData!.scenario.theme}</p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {simState === 'today_pending' && '오늘의 시나리오가 열렸습니다 새로운 시나리오를 확인하고 투자하세요!'}
                        {simState === 'today_done' && `오늘 +${todayAlloc?.tags?.length ?? 0}개 전략 태그 기록`}
                        {simState === 'finalized' && '시즌이 종료되었습니다 · 결과를 확인해 보세요'}
                      </p>
                      <div className="w-full bg-surface-variant h-2 rounded-full mt-3 overflow-hidden">
                        <div
                          className="bg-[#1A237E] h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 flex-wrap gap-1 items-baseline">
                        <span className="text-sm font-semibold text-on-surface-variant tabular-nums">
                          진행률 {pData!.today_index}/{SIMULATOR_TOTAL_DAYS}
                        </span>
                        {simState === 'today_done' && todayValue != null && todayReturn != null && (
                          <span className={`text-sm font-bold tabular-nums ${isUp ? 'text-emerald-700' : 'text-red-700'}`}>
                            ₩{Math.floor(todayValue).toLocaleString()} ({isUp ? '+' : ''}{todayReturn.toFixed(2)}%)
                          </span>
                        )}
                        {(simState === 'today_pending' || simState === 'finalized') && (
                          <span className="text-sm font-bold tabular-nums text-[#1A237E]">
                            ₩{Math.floor(pData!.current_value).toLocaleString()} ({pData!.total_return >= 0 ? '+' : ''}{pData!.total_return.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <span className="mt-6 w-full bg-[#1A237E] text-white font-bold text-base py-3 rounded-xl text-center inline-block">
                  {cta}
                </span>
              </button>
            );
          })()}

          {/* 카드 B — 일일 퀴즈 */}
          <button
            type="button"
            onClick={() => navigate('/dashboard/quiz')}
            className="text-left bg-surface-container-lowest rounded-2xl p-6 flex flex-col justify-between border border-outline-variant/30 hover:border-[#1A237E]/40 hover:shadow-md transition-all min-h-[280px] cursor-pointer"
          >
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[#1A237E]">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>
                    quiz
                  </span>
                  <h3 className="text-xl font-black tracking-tight">오늘의 퀴즈</h3>
                </div>
                {todayDone ? (
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap">
                    완료 · {dailyQuizResult!.correctCount}/{dailyQuizResult!.total}
                  </span>
                ) : (
                  <span className="bg-surface-container-high text-on-surface-variant text-xs font-bold tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap">
                    미완료 · 오늘
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-base text-on-surface">6문제 · 자정에 자동 갱신</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {todayDone ? `+${dailyQuizResult!.exp} EXP 획득` : '오늘 풀이 시작 전'}
                </p>
                <div className="w-full bg-surface-variant h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-[#1A237E] h-full rounded-full transition-all duration-500"
                    style={{ width: todayDone ? '100%' : '0%' }}
                  />
                </div>
                <div className="flex justify-between mt-2 flex-wrap gap-1 items-baseline">
                  <span className="text-sm font-semibold text-on-surface-variant flex items-center gap-1">
                    🔥 현재 streak {streak}일
                  </span>
                  <span className="text-sm font-bold text-on-surface-variant tabular-nums">
                    누적 정답률 {quizAccuracy !== null ? `${quizAccuracy}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
            <span className="mt-6 w-full bg-[#1A237E] text-white font-bold text-base py-3 rounded-xl text-center inline-block">
              {todayDone ? '결과 다시 보기' : '오늘의 퀴즈 풀기'}
            </span>
          </button>
        </div>
      </section>

      {/* ─── 섹션 2: 실시간 인기 뉴스 ─────────────────────────────────────────── */}
      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant/20 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-orange-500"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              local_fire_department
            </span>
            <h2 className="text-xl font-extrabold text-[#1A237E] font-headline flex items-center gap-2">
              실시간 인기 뉴스
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
            </h2>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-on-surface-variant/70 font-medium">
              최근 24시간 · 조회수 기준
            </span>
            <button
              onClick={() => navigate('/dashboard/news')}
              className="flex items-center gap-1 text-sm font-bold text-[#1A237E] hover:opacity-80 transition-opacity group"
            >
              전체보기
              <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">
                chevron_right
              </span>
            </button>
          </div>
        </div>

        {popularNewsLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-32 bg-surface-container-low rounded-2xl" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-surface-container-low rounded-lg" />
            ))}
          </div>
        ) : popularNews.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-8 text-center">
            아직 집계된 인기 뉴스가 없습니다.
          </p>
        ) : (
          <>
            {/* Rank #1 Hero Card */}
            {popularNews[0] && (
              <article
                onClick={() => handleNewsClick(popularNews[0].id, popularNews[0].link)}
                className="relative w-full rounded-2xl bg-gradient-to-br from-[#1A237E]/5 to-transparent border border-[#1A237E]/10 p-6 mb-4 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="absolute top-4 left-6 text-4xl font-black italic text-[#1A237E]/20">
                  01
                </div>
                <div className="pl-14 pt-2">
                  <h3 className="font-bold text-[20px] md:text-[22px] leading-tight text-[#1A237E] mb-2 group-hover:opacity-90 transition-opacity line-clamp-2">
                    {popularNews[0].title}
                  </h3>
                  {(popularNews[0].reason || popularNews[0].description) && (
                    <p className="text-sm md:text-base text-on-surface-variant mb-4 line-clamp-2">
                      {popularNews[0].reason || popularNews[0].description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 md:gap-3 text-sm flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getSentimentClass(
                        popularNews[0].sentiment
                      )}`}
                    >
                      {popularNews[0].sentiment}
                    </span>
                    <span className="text-on-surface-variant font-semibold text-xs md:text-sm">
                      {popularNews[0].category}
                    </span>
                    <span className="text-on-surface-variant/50">•</span>
                    <span className="text-on-surface-variant font-semibold text-xs md:text-sm">
                      {formatTimeAgo(popularNews[0].pub_date)}
                    </span>
                    <span className="text-on-surface-variant/50">•</span>
                    <span className="text-on-surface-variant font-semibold text-xs md:text-sm flex items-center gap-1 tabular-nums">
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      {popularNews[0].view_count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </article>
            )}

            {/* Ranks #2 ~ #5 */}
            <div className="flex flex-col">
              {popularNews.slice(1, 5).map((n, idx, arr) => {
                const rank = idx + 2;
                const isLast = idx === arr.length - 1;
                return (
                  <article
                    key={n.id}
                    onClick={() => handleNewsClick(n.id, n.link)}
                    className={`flex items-center py-4 ${
                      !isLast ? 'border-b border-outline-variant/20' : ''
                    } hover:bg-[#1A237E]/5 transition-colors px-2 rounded-lg cursor-pointer group gap-2`}
                  >
                    <span className="text-lg md:text-xl font-bold text-on-surface-variant/40 w-8 md:w-10 text-center tabular-nums shrink-0">
                      {String(rank).padStart(2, '0')}
                    </span>
                    <div className="flex-1 px-2 md:px-4 min-w-0">
                      <h4 className="font-bold text-sm md:text-base text-on-surface group-hover:text-[#1A237E] transition-colors truncate">
                        {n.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                      <span
                        className={`px-2 md:px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${getSentimentClass(
                          n.sentiment
                        )}`}
                      >
                        {n.sentiment}
                      </span>
                      <span className="hidden sm:inline text-xs md:text-sm font-semibold text-on-surface-variant w-14 md:w-16 text-right">
                        {formatTimeAgo(n.pub_date)}
                      </span>
                      <span className="hidden md:flex text-sm font-semibold text-on-surface-variant w-20 text-right items-center justify-end gap-1 tabular-nums">
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        {n.view_count.toLocaleString()}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ─── 섹션 3: 실시간 시장 지수 (기존 유지) ────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-extrabold text-primary font-headline">실시간 시장 지수</h2>
          <span className="text-xs text-on-surface-variant font-medium">
            {marketLoading
              ? '데이터 로딩 중... (첫 로드는 약 20~30초 소요)'
              : marketError
              ? '데이터 불러오기 실패'
              : marketUpdatedAt
              ? `업데이트: ${formatUpdatedAt(marketUpdatedAt)}`
              : '업데이트 정보 없음'}
          </span>
        </div>

        {!marketLoading && !marketError && (
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveTab(cat.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === cat.key
                    ? 'bg-[#1A237E] text-white'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-lowest'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {marketError ? (
            <div className="col-span-2 md:col-span-3 flex flex-col items-center justify-center gap-3 py-8">
              <div className="flex items-center gap-2 text-sm font-bold text-on-surface-variant">
                <span className="material-symbols-outlined text-base">wifi_off</span>
                데이터를 불러오지 못했습니다.
              </div>
              <button
                onClick={fetchMarket}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A237E] text-white text-sm font-bold hover:bg-[#1A237E]/90 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                다시 시도
              </button>
            </div>
          ) : marketLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface-container-low p-5 rounded-xl animate-pulse">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-3" />
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24" />
              </div>
            ))
          ) : (
            (CATEGORIES.find((c) => c.key === activeTab)?.keys ?? []).map((key) => {
              const item = marketData?.[key];
              const isUp = item ? item.change_rate >= 0 : true;
              return (
                <div
                  key={key}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-xl shadow-sm transition-all hover:shadow-md hover:border-slate-300 cursor-default"
                >
                  <p className="text-xs font-bold text-on-surface-variant mb-1">{INDEX_LABEL[key] ?? key}</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl font-black font-headline">
                      {item ? formatPrice(key, item.price) : '—'}
                    </span>
                    {item && (
                      <div className={`flex flex-col text-[10px] font-bold ${isUp ? 'text-error' : 'text-blue-700'}`}>
                        <span className="flex items-center">
                          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>
                            {isUp ? 'arrow_drop_up' : 'arrow_drop_down'}
                          </span>
                          {Math.abs(item.change_rate).toFixed(2)}%
                        </span>
                        <span className="text-on-surface-variant pl-1">
                          {isUp ? '+' : ''}
                          {item.change_value.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

// ─── 누적 통계 카드 ────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  subColor,
  progress,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  progress?: number;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1A237E]/10 flex items-center justify-center text-[#1A237E] flex-shrink-0">
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <span className="text-sm font-medium text-on-surface-variant">{label}</span>
      </div>
      <p className="text-3xl font-black tabular-nums text-on-surface">{value}</p>
      {progress !== undefined ? (
        <div>
          <p className="text-xs font-bold text-on-surface-variant mb-1.5">다음 레벨까지 {progress}%</p>
          <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
            <div className="bg-[#1A237E] h-full rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : sub ? (
        <p className={`text-xs ${subColor ?? 'text-on-surface-variant'}`}>{sub}</p>
      ) : null}
    </div>
  );
}
