import { Fragment, useEffect, useState } from 'react';

// ─── 임시 mock 데이터 (백엔드 연동 전) ─────────────────────────────────────────
type QuizItem = {
  id: number;
  category: string;
  question: string;
  options: string[];
  answer: number; // index of options
  explanation: string;
};

const MOCK_DAILY_QUIZ: QuizItem[] = [
  {
    id: 1,
    category: '거시지표',
    question: '금리가 인상되면 채권 가격은 일반적으로 어떻게 변할까요?',
    options: ['변동 없다', '하락한다', '상승한다', '만기에 따라 다르다'],
    answer: 1,
    explanation: '기존 채권의 이자율이 새로 발행되는 고금리 채권보다 매력도가 떨어지기 때문에 시장에서 가격이 하락하게 됩니다.',
  },
  {
    id: 2,
    category: '주식',
    question: '주가수익비율(PER)이 높다는 것은 무엇을 의미할까요?',
    options: ['저평가됨', '현재 이익 대비 주가가 비쌈', '안정적인 배당', '거래량이 많음'],
    answer: 1,
    explanation: 'PER이 높다는 것은 같은 이익을 내는 회사 대비 주가가 비싸다는 뜻입니다. 시장의 성장 기대가 반영된 결과입니다.',
  },
  {
    id: 3,
    category: '거시지표',
    question: '인플레이션이 지속되면 일반적으로 어떤 자산이 유리할까요?',
    options: ['장기 채권', '실물 자산 (금, 부동산)', '현금', '예금'],
    answer: 1,
    explanation: '인플레이션은 화폐 가치를 떨어뜨리므로, 시간이 지나도 가치가 유지되는 실물 자산(금·부동산)이 상대적으로 유리합니다.',
  },
  {
    id: 4,
    category: '환율',
    question: '원화 가치가 약세일 때 가장 유리한 업종은?',
    options: ['수입 의존도가 높은 업종', '수출 비중이 높은 업종', '내수 소비재', '관광 수입 업종'],
    answer: 1,
    explanation: '원화가 약세면 해외에서 같은 외화를 받아도 원화 환산 매출이 늘어나기 때문에 수출 업종에 유리합니다.',
  },
  {
    id: 5,
    category: '리스크',
    question: '분산 투자의 가장 큰 목적은 무엇일까요?',
    options: ['수익률 극대화', '리스크 감소', '세금 절감', '거래 수수료 절약'],
    answer: 1,
    explanation: '서로 다른 움직임을 보이는 자산에 나눠 투자해 한 자산의 손실을 다른 자산의 이익으로 상쇄, 전체 변동성(리스크)을 낮추는 것이 목적입니다.',
  },
];

const MOCK_INFINITE_POOL: QuizItem[] = [
  ...MOCK_DAILY_QUIZ,
  {
    id: 101,
    category: '거시지표',
    question: 'CPI(소비자물가지수)가 발표되는 빈도는?',
    options: ['주간', '월간', '분기', '연간'],
    answer: 1,
    explanation: 'CPI는 일반적으로 매월 발표되며, 통계청·중앙은행의 정책 결정에 핵심 지표로 사용됩니다.',
  },
  {
    id: 102,
    category: '주식',
    question: '배당락일이란?',
    options: [
      '배당금이 입금되는 날',
      '배당 권리가 사라지는 첫 거래일',
      '배당이 결정되는 이사회 날',
      '배당이 지급 발표되는 날',
    ],
    answer: 1,
    explanation: '배당락일 이후 주식을 사면 그 회차 배당을 받을 수 없습니다. 통상 주가는 배당 금액만큼 자연 하락합니다.',
  },
];

type RankingEntry = { rank: number; nickname: string; score: number };
const MOCK_RANKING: RankingEntry[] = Array.from({ length: 100 }, (_, i) => ({
  rank: i + 1,
  nickname: ['AlphaGosu', 'WarrenB', 'CoinKing', 'BondMaster', 'BullRunner', 'BearHunter'][i % 6] + `_${i + 1}`,
  score: Math.max(0, 9500 - i * 80 - Math.floor(Math.random() * 50)),
}));
const MOCK_MY_RANK = { rank: 87, nickname: 'me', score: 2840 };

// 일일 퀴즈 streak / 결과는 임시 localStorage 보관
const TODAY_KEY = `fintor_quiz_daily_${new Date().toISOString().slice(0, 10)}`;
const STREAK_KEY = 'fintor_quiz_streak';

type DailyResult = {
  correctCount: number;
  total: number;
  results: boolean[]; // 문제별 정답 여부
  exp: number;
  streak: number;
};

// ─── 메인 Quiz 페이지 ─────────────────────────────────────────────────────────
export function Quiz() {
  // daily quiz state
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null);
  const [solving, setSolving] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [sessionResults, setSessionResults] = useState<boolean[]>([]);
  const [countdown, setCountdown] = useState('00:00:00');

  // modals
  const [infiniteOpen, setInfiniteOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  // 초기 로드: 오늘 푼 결과 확인
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TODAY_KEY);
      if (raw) setDailyResult(JSON.parse(raw) as DailyResult);
    } catch {}
  }, []);

  // 다음 자정까지 카운트다운
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 모달 열린 동안 배경 스크롤 잠금
  useEffect(() => {
    const anyOpen = infiniteOpen || rankingOpen;
    if (!anyOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [infiniteOpen, rankingOpen]);

  const startDaily = () => {
    setSolving(true);
    setCurrentIdx(0);
    setSelectedOpt(null);
    setRevealed(false);
    setSessionResults([]);
  };

  const selectOption = (idx: number) => {
    if (revealed) return;
    setSelectedOpt(idx);
    setRevealed(true);
    const correct = idx === MOCK_DAILY_QUIZ[currentIdx].answer;
    setSessionResults((prev) => [...prev, correct]);
  };

  const goNext = () => {
    if (currentIdx + 1 >= MOCK_DAILY_QUIZ.length) {
      // 완료
      const correctCount = sessionResults.filter(Boolean).length;
      const prevStreak = Number(localStorage.getItem(STREAK_KEY) ?? '0');
      const newStreak = correctCount >= 3 ? prevStreak + 1 : 0;
      const exp = correctCount * 10 + (correctCount === MOCK_DAILY_QUIZ.length ? 20 : 0);
      const result: DailyResult = {
        correctCount,
        total: MOCK_DAILY_QUIZ.length,
        results: sessionResults,
        exp,
        streak: newStreak,
      };
      localStorage.setItem(TODAY_KEY, JSON.stringify(result));
      localStorage.setItem(STREAK_KEY, String(newStreak));
      setDailyResult(result);
      setSolving(false);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedOpt(null);
      setRevealed(false);
    }
  };

  // 헤더 통계: 누적 정답률은 mock (구현 시 백엔드)
  const streak = dailyResult?.streak ?? Number(localStorage.getItem(STREAK_KEY) ?? '0');

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      {/* SECTION 1: 오늘의 퀴즈 챌린지 */}
      <section>
        {!dailyResult && !solving && <DailyStart streak={streak} onStart={startDaily} />}
        {solving && (
          <DailySolving
            quiz={MOCK_DAILY_QUIZ[currentIdx]}
            index={currentIdx}
            total={MOCK_DAILY_QUIZ.length}
            selectedOpt={selectedOpt}
            revealed={revealed}
            onSelect={selectOption}
            onNext={goNext}
            isLast={currentIdx + 1 >= MOCK_DAILY_QUIZ.length}
          />
        )}
        {dailyResult && !solving && <DailyFinished result={dailyResult} countdown={countdown} />}
      </section>

      {/* SECTION 2: 시즌 챌린지 — 단일 카드 (도전 + 랭킹 진입) */}
      <SeasonChallengeCard
        onStart={() => setInfiniteOpen(true)}
        onRanking={() => setRankingOpen(true)}
      />

      {/* [DEV ONLY] 일일 퀴즈 초기화 버튼 - 테스트 전용, 배포 전 제거 필요 */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => {
            if (!confirm('[DEV] 오늘의 일일 퀴즈 진행 기록을 초기화하시겠습니까?')) return;
            localStorage.removeItem(TODAY_KEY);
            setDailyResult(null);
            setSolving(false);
            setCurrentIdx(0);
            setSelectedOpt(null);
            setRevealed(false);
            setSessionResults([]);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-red-400 text-red-500 font-bold text-xs hover:bg-red-50 transition-colors"
          title="[DEV] 일일 퀴즈 초기화"
        >
          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
          [DEV] 일일 퀴즈 초기화
        </button>
      </div>

      {/* 모달들 */}
      {infiniteOpen && <InfiniteModal onClose={() => setInfiniteOpen(false)} />}
      {rankingOpen && <RankingModal onClose={() => setRankingOpen(false)} />}
    </div>
  );
}

// ─── 일일 퀴즈: 시작 전 ──────────────────────────────────────────────────────
function DailyStart({ streak, onStart }: { streak: number; onStart: () => void }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col border border-outline-variant/30">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#1A237E]/10 text-[#1A237E] mb-3">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>quiz</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface mb-2">오늘의 퀴즈 챌린지</h2>
        <p className="text-sm font-medium text-on-surface-variant">매일 새로운 5문제 · 자정에 자동 갱신</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 bg-surface-container-low rounded-xl p-4 flex items-center justify-center gap-3">
          <span className="text-xl">🔥</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">연속 달성</span>
            <span className="text-lg font-bold text-on-surface tabular-nums">{streak}일 연속</span>
          </div>
        </div>
        <div className="flex-1 bg-surface-container-low rounded-xl p-4 flex items-center justify-center gap-3">
          <span className="material-symbols-outlined text-[#1A237E]">pie_chart</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">누적 정답률</span>
            <span className="text-lg font-bold text-on-surface tabular-nums">82.4%</span>
          </div>
        </div>
      </div>
      <button
        onClick={onStart}
        className="w-full bg-[#1A237E] text-white font-bold text-base py-4 rounded-xl shadow-sm hover:bg-[#1f2a8c] transition-colors"
      >
        오늘의 퀴즈 풀기
      </button>
    </div>
  );
}

// ─── 일일 퀴즈: 풀이 중 ─────────────────────────────────────────────────────
function DailySolving({
  quiz,
  index,
  total,
  selectedOpt,
  revealed,
  onSelect,
  onNext,
  isLast,
}: {
  quiz: QuizItem;
  index: number;
  total: number;
  selectedOpt: number | null;
  revealed: boolean;
  onSelect: (idx: number) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const progressPct = Math.round(((index + (revealed ? 1 : 0)) / total) * 100);
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col border border-outline-variant/30">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          문제 {index + 1} / {total}
        </span>
        <span className="bg-[#1A237E]/10 text-[#1A237E] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
          {quiz.category}
        </span>
      </div>
      <div className="w-full h-2 bg-surface-variant rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-[#1A237E] rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>
      <h3 className="text-lg md:text-xl font-bold text-on-surface mb-6 leading-snug">{quiz.question}</h3>
      <div className="flex flex-col gap-3 mb-6">
        {quiz.options.map((opt, i) => {
          const isSelected = selectedOpt === i;
          const isCorrect = quiz.answer === i;
          const isWrong = revealed && isSelected && !isCorrect;
          let cls = 'w-full text-left p-4 rounded-xl border-2 font-medium text-base transition-all flex justify-between items-center ';
          if (!revealed) {
            cls += isSelected
              ? 'border-[#1A237E] bg-[#1A237E]/10 text-[#1A237E] font-bold'
              : 'border-outline-variant/40 text-on-surface hover:border-[#1A237E]/40 hover:bg-[#1A237E]/5 cursor-pointer';
          } else {
            if (isCorrect) cls += 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold';
            else if (isWrong) cls += 'border-red-400 bg-red-50 text-red-600 font-medium';
            else cls += 'border-outline-variant/30 text-on-surface-variant opacity-60';
          }
          return (
            <button key={i} onClick={() => onSelect(i)} disabled={revealed} className={cls}>
              <span>
                <span className="mr-2 text-on-surface-variant">{i + 1}.</span>
                {opt}
              </span>
              {revealed && isCorrect && (
                <span
                  className="material-symbols-outlined text-emerald-600 text-[20px]"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  check_circle
                </span>
              )}
              {revealed && isWrong && (
                <span className="material-symbols-outlined text-red-500 text-[20px]">cancel</span>
              )}
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="bg-surface-container-low rounded-xl p-4 flex gap-3 items-start mb-6">
          <span
            className="material-symbols-outlined text-[#1A237E] mt-0.5 flex-shrink-0"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            tips_and_updates
          </span>
          <div>
            <p className="text-sm font-bold text-on-surface mb-1">
              정답: {quiz.options[quiz.answer]}
            </p>
            <p className="text-sm text-on-surface-variant leading-relaxed">{quiz.explanation}</p>
          </div>
        </div>
      )}
      <button
        onClick={onNext}
        disabled={!revealed}
        className="w-full bg-[#1A237E] text-white font-bold text-base py-4 rounded-xl shadow-sm hover:bg-[#1f2a8c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLast ? (
          <>
            결과 보기
            <span className="material-symbols-outlined text-[18px]">flag</span>
          </>
        ) : (
          <>
            다음 문제
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </>
        )}
      </button>
    </div>
  );
}

// ─── 일일 퀴즈: 완료 ────────────────────────────────────────────────────────
function DailyFinished({ result, countdown }: { result: DailyResult; countdown: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col items-center text-center border border-outline-variant/30">
      <span className="text-m font-bold uppercase tracking-widest text-on-surface-variant mt-2 mb-2">
        오늘의 최종 점수
      </span>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-6xl md:text-7xl font-black tracking-tight text-[#1A237E] leading-none tabular-nums">
          {result.correctCount}
        </span>
        <span className="text-3xl font-medium text-on-surface-variant">/ {result.total}</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <span className="bg-[#1A237E] text-white text-xs font-bold px-3 py-1.5 rounded-full">
          +{result.exp} EXP
        </span>
        {result.streak > 0 && (
          <span className="bg-surface-container-high text-on-surface text-xs font-bold px-3 py-1.5 rounded-full">
            🔥 {result.streak}일 연속 달성!
          </span>
        )}
      </div>
      <div className="flex gap-2 mb-6">
        {result.results.map((isCorrect, i) => (
          <div
            key={i}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
              isCorrect
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-600'
            }`}
          >
            {isCorrect ? 'O' : 'X'}
          </div>
        ))}
      </div>
      <div className="w-full pt-5 border-t border-outline-variant/30">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">다음 퀴즈까지</p>
        <p className="text-2xl font-bold text-on-surface tabular-nums">{countdown}</p>
      </div>
    </div>
  );
}

// ─── 시즌 챌린지 카드 (도전 시작 + 랭킹 보기 진입) ─────────────────────────
function SeasonChallengeCard({
  onStart,
  onRanking,
}: {
  onStart: () => void;
  onRanking: () => void;
}) {
  const myBest = Number(localStorage.getItem('fintor_infinite_best') ?? '0');
  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant/50 p-6 md:p-8 shadow-sm">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[#1A237E] text-[28px]"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              emoji_events
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">시즌 챌린지</h2>
          </div>
          <span className="bg-[#1A237E]/10 text-[#1A237E] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            SEASON 3 · 5일 남음
          </span>
        </div>
        <p className="text-sm font-medium text-on-surface-variant">
          무한 퀴즈에 도전해 점수를 쌓고 시즌 랭킹에 이름을 올려보세요.
        </p>
      </div>

      {/* 통계 2개 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-surface-container-lowest rounded-xl p-4 flex items-center gap-4 border border-outline-variant/50">
          <div className="bg-surface-variant p-2 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[#1A237E]">all_inclusive</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-on-surface-variant mb-0.5">무한 퀴즈 최고 기록</div>
            <div className="text-base font-bold text-[#1A237E] tabular-nums">{myBest} 문제 연속</div>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 flex items-center gap-4 border border-outline-variant/50">
          <div className="bg-surface-variant p-2 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[#1A237E]">leaderboard</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-on-surface-variant mb-0.5">현재 내 순위</div>
            <div className="text-base font-bold text-[#1A237E] tabular-nums">
              {MOCK_MY_RANK.rank}위 / {MOCK_RANKING.length.toLocaleString()}명
            </div>
          </div>
        </div>
      </div>

      {/* 액션 버튼 2개 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onStart}
          className="flex-1 bg-[#1A237E] text-white rounded-xl py-3 px-6 flex items-center justify-center gap-2 font-bold text-base hover:bg-[#1f2a8c] transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined">play_arrow</span>
          도전 시작
        </button>
        <button
          onClick={onRanking}
          className="flex-1 bg-transparent border-2 border-[#1A237E] text-[#1A237E] rounded-xl py-3 px-6 flex items-center justify-center gap-2 font-bold text-base hover:bg-[#1A237E]/5 transition-colors"
        >
          <span className="material-symbols-outlined">leaderboard</span>
          랭킹 보기
        </button>
      </div>
    </div>
  );
}

// ─── 무한 챌린지 모달 ────────────────────────────────────────────────────────
function InfiniteModal({ onClose }: { onClose: () => void }) {
  const [pool] = useState(() => [...MOCK_INFINITE_POOL].sort(() => Math.random() - 0.5));
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  const current = pool[idx % pool.length];

  const select = (i: number) => {
    if (revealed) return;
    setSelectedOpt(i);
    setRevealed(true);
    if (i === current.answer) {
      setStreak((s) => s + 1);
    } else {
      // 즉시 종료
      setTimeout(() => {
        const best = Number(localStorage.getItem('fintor_infinite_best') ?? '0');
        if (streak > best) localStorage.setItem('fintor_infinite_best', String(streak));
        setFinished(true);
      }, 1200);
    }
  };

  const next = () => {
    setIdx((i) => i + 1);
    setSelectedOpt(null);
    setRevealed(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pb-24 md:pb-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] md:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-surface-container-lowest flex items-center justify-between p-5 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1A237E]">all_inclusive</span>
            <span className="text-base font-bold text-on-surface">무한 랭킹 퀴즈</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-low" aria-label="닫기">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {!finished ? (
          <div className="p-6 flex flex-col gap-5">
            {/* 연속 정답 카운터 */}
            <div className="flex flex-col items-center py-2">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                현재 연속 정답
              </span>
              <span className="text-5xl font-black tracking-tight text-[#1A237E] tabular-nums">{streak}</span>
            </div>

            {/* 문제 */}
            <div className="flex flex-col gap-4">
              <span className="self-start bg-[#1A237E]/10 text-[#1A237E] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                {current.category}
              </span>
              <h3 className="text-lg md:text-xl font-bold text-on-surface leading-snug">{current.question}</h3>
              <div className="flex flex-col gap-3">
                {current.options.map((opt, i) => {
                  const isSelected = selectedOpt === i;
                  const isCorrect = current.answer === i;
                  const isWrong = revealed && isSelected && !isCorrect;
                  let cls = 'w-full text-left p-4 rounded-xl border-2 font-medium text-base transition-all flex justify-between items-center ';
                  if (!revealed) {
                    cls += isSelected
                      ? 'border-[#1A237E] bg-[#1A237E]/10 text-[#1A237E] font-bold'
                      : 'border-outline-variant/40 text-on-surface hover:border-[#1A237E]/40 hover:bg-[#1A237E]/5 cursor-pointer';
                  } else {
                    if (isCorrect) cls += 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold';
                    else if (isWrong) cls += 'border-red-400 bg-red-50 text-red-600';
                    else cls += 'border-outline-variant/30 text-on-surface-variant opacity-60';
                  }
                  return (
                    <button key={i} onClick={() => select(i)} disabled={revealed} className={cls}>
                      <span>
                        <span className="mr-2 text-on-surface-variant">{i + 1}.</span>
                        {opt}
                      </span>
                      {revealed && isCorrect && (
                        <span
                          className="material-symbols-outlined text-emerald-600 text-[20px]"
                          style={{ fontVariationSettings: '"FILL" 1' }}
                        >
                          check_circle
                        </span>
                      )}
                      {revealed && isWrong && (
                        <span className="material-symbols-outlined text-red-500 text-[20px]">cancel</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {revealed && selectedOpt === current.answer && (
                <button
                  onClick={next}
                  className="w-full bg-[#1A237E] text-white font-bold text-base py-3 rounded-xl hover:bg-[#1f2a8c] transition-colors flex items-center justify-center gap-2"
                >
                  다음 문제
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">최종 기록</span>
            <span className="text-6xl font-black tracking-tight text-[#1A237E] tabular-nums mb-2">{streak}</span>
            <span className="text-base text-on-surface-variant mb-6">시즌 랭킹에 반영됩니다</span>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => {
                  setIdx(0);
                  setStreak(0);
                  setSelectedOpt(null);
                  setRevealed(false);
                  setFinished(false);
                }}
                className="flex-1 border-2 border-[#1A237E] text-[#1A237E] font-bold text-base py-3 rounded-xl hover:bg-[#1A237E]/5 transition-colors"
              >
                다시 도전
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-[#1A237E] text-white font-bold text-base py-3 rounded-xl hover:bg-[#1f2a8c] transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 랭킹 모달 ──────────────────────────────────────────────────────────────
function RankingModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-24 md:p-6 md:pb-6"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-xl max-h-[85vh] md:max-h-[90vh] flex flex-col overflow-hidden border border-outline-variant/50 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-outline-variant/30 flex justify-between items-start flex-shrink-0">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">시즌 3 랭킹</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest bg-red-50 text-red-700">
                D-5
              </span>
              <p className="text-sm text-on-surface-variant">남은 일수 5일</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface p-2 rounded-full transition-colors"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* 내 순위 하이라이트 (상단 고정) */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <div className="bg-[#1A237E] text-white rounded-xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-300 opacity-20 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="flex flex-col items-center justify-center min-w-[40px]">
                <span className="text-sm font-bold text-white/60 tabular-nums">{MOCK_MY_RANK.rank}위</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/20">
                <span
                  className="material-symbols-outlined text-white"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  emoji_events
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold">{MOCK_MY_RANK.nickname}</span>
                <span className="text-xs font-bold uppercase tracking-widest text-white/60 mt-0.5">내 순위</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1 relative z-10">
              <span className="text-2xl font-black tabular-nums">{MOCK_MY_RANK.score.toLocaleString()}</span>
              <span className="text-sm text-white/60">점</span>
            </div>
          </div>
        </div>

        {/* 랭킹 리스트 */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2 space-y-1">
          {MOCK_RANKING.map((e, i) => {
            const isTop3 = i < 3;
            const trophyColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : 'text-amber-700';
            const avatarStyle =
              i === 0
                ? 'bg-yellow-50 text-yellow-700'
                : i === 1
                ? 'bg-slate-100 text-slate-600'
                : i === 2
                ? 'bg-amber-50 text-amber-700'
                : 'bg-surface-variant text-on-surface-variant';
            const scoreStyle =
              i === 0
                ? 'text-yellow-600 font-bold'
                : i === 1
                ? 'text-slate-600 font-bold'
                : i === 2
                ? 'text-amber-700 font-bold'
                : 'text-on-surface-variant font-semibold';
            return (
              <Fragment key={e.rank}>
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-colors mx-2 group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 flex justify-center flex-shrink-0">
                      {isTop3 ? (
                        <span
                          className={`material-symbols-outlined ${trophyColor} transform group-hover:scale-110 transition-transform`}
                          style={{
                            fontVariationSettings: '"FILL" 1',
                            fontSize: i === 0 ? '28px' : i === 1 ? '26px' : '24px',
                          }}
                        >
                          emoji_events
                        </span>
                      ) : (
                        <span className="text-base font-bold text-on-surface-variant tabular-nums">{e.rank}</span>
                      )}
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${avatarStyle}`}>
                      <span className="material-symbols-outlined text-[18px]">person</span>
                    </div>
                    <span
                      className={`truncate ${isTop3 ? 'text-lg font-bold text-on-surface' : 'text-base font-medium text-on-surface'}`}
                    >
                      {e.nickname}
                    </span>
                  </div>
                  <span className={`text-base tabular-nums whitespace-nowrap ${scoreStyle}`}>
                    {e.score.toLocaleString()}점
                  </span>
                </div>
                {i === 2 && (
                  <div className="py-2 px-4">
                    <div className="h-px bg-outline-variant/40 w-full" />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        {/* 하단 fade gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-surface-container-lowest to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
