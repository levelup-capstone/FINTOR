import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  fetchTodayQuiz, submitAnswer, checkAnswer, fetchQuizStatus,
  fetchInfinitePool, submitInfiniteScore, fetchRanking, completeDailyQuiz,
  type QuizQuestion, type SubmitResult, type RankingData,
} from './quizApi';
import { LevelUpModal, type LevelUpPayload } from '../components/LevelUpModal';


type DailyResult = {
  correctCount: number;
  total: number;
  results: boolean[];
  exp: number;
  streak: number;
};

// ─── 메인 Quiz 페이지 ─────────────────────────────────────────────────────────
export function Quiz() {
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null);
  const [solving, setSolving] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [sessionResults, setSessionResults] = useState<boolean[]>([]);
  const [countdown, setCountdown] = useState('00:00:00');

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [myBest, setMyBest] = useState(0);
  const [currentSeason, setCurrentSeason] = useState(1);

  const [infiniteOpen, setInfiniteOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [cachedQuestions, setCachedQuestions] = useState<QuizQuestion[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  // 레벨업 모달 (일일 퀴즈 / streak milestone 등으로 레벨업 시 표시)
  const [levelUpPayload, setLevelUpPayload] = useState<LevelUpPayload | null>(null);

  useEffect(() => {
    fetchTodayQuiz().then((data) => {
      if (!data) return;
      setCachedQuestions(data.questions);
      setCurrentStreak(data.current_streak);
      if (data.already_completed && data.completion) {
        const c = data.completion;
        const exp = c.correct_count * 3 + (c.correct_count === c.total ? 5 : 0);
        setDailyResult({ correctCount: c.correct_count, total: c.total, results: c.results, exp, streak: c.streak });
      }
    });

    fetchQuizStatus().then((s) => { if (s) setAccuracy(s.accuracy); });
    fetchRanking().then((d) => {
      if (d) { setMyRank(d.my_rank); setTotalUsers(d.total_users); setMyBest(d.my_score); setCurrentSeason(d.season); }
    });
  }, []);

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

  useEffect(() => {
    const anyOpen = infiniteOpen || rankingOpen;
    if (!anyOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [infiniteOpen, rankingOpen]);

  const startDaily = async () => {
    let qs = cachedQuestions;
    if (qs.length === 0) {
      setQuizLoading(true);
      const data = await fetchTodayQuiz();
      setQuizLoading(false);
      if (!data || data.questions.length === 0) return;
      qs = data.questions;
      setCachedQuestions(qs);
      setCurrentStreak(data.current_streak);
    }
    setQuestions(qs);
    setSolving(true);
    setCurrentIdx(0);
    setSelectedOpt(null);
    setRevealed(false);
    setSessionResults([]);
    setSubmitResult(null);
  };

  const selectOption = async (answer: string) => {
    if (revealed || submitting || !questions[currentIdx]) return;
    setSelectedOpt(answer);
    setSubmitting(true);
    const q = questions[currentIdx];
    const result = await submitAnswer(q.id, answer);
    setSubmitResult(result);
    setRevealed(true);
    setSubmitting(false);
    if (result) setSessionResults((prev) => [...prev, result.is_correct]);
  };

  const goNext = async () => {
    const total = questions.length;
    if (currentIdx + 1 >= total) {
      const correctCount = sessionResults.filter(Boolean).length;
      const newStreak = currentStreak + 1;

      // 서버 응답을 받은 후 결과 화면 표시 → 표시되는 EXP가 실제 부여된 값과 일치
      const resp = await completeDailyQuiz(correctCount, total, newStreak, sessionResults);
      // 응답 실패 시 fallback (백엔드와 동일 공식 — 보통 발생 안 함)
      const exp = resp
        ? resp.granted_exp
        : correctCount * 3 + (correctCount === total ? 5 : 0);

      const result: DailyResult = {
        correctCount,
        total,
        results: sessionResults,
        exp,
        streak: newStreak,
      };
      setDailyResult(result);
      setSolving(false);

      if (resp?.leveled_up && resp.new_level != null) {
        setLevelUpPayload({
          newLevel:         resp.new_level,
          gainedLevels:     resp.gained_levels,
          granted:          resp.granted_exp,
          milestoneBonus:   resp.milestone_bonus,
          milestoneReached: resp.milestone_reached,
          source:           '오늘의 퀴즈',
        });
      }
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedOpt(null);
      setRevealed(false);
      setSubmitResult(null);
    }
  };

  const streak = dailyResult?.streak ?? currentStreak;

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      <section data-tour="daily-quiz-card">
        {!dailyResult && !solving && (
          <DailyStart streak={streak} accuracy={accuracy} onStart={startDaily} loading={quizLoading} />
        )}
        {solving && questions[currentIdx] && (
          <DailySolving
            quiz={questions[currentIdx]}
            index={currentIdx}
            total={questions.length}
            selectedOpt={selectedOpt}
            revealed={revealed}
            submitting={submitting}
            submitResult={submitResult}
            onSelect={selectOption}
            onNext={goNext}
            isLast={currentIdx + 1 >= questions.length}
          />
        )}
        {dailyResult && !solving && <DailyFinished result={dailyResult} countdown={countdown} />}
      </section>

      <SeasonChallengeCard
        season={currentSeason}
        myRank={myRank}
        totalUsers={totalUsers}
        myBest={myBest}
        onStart={() => setInfiniteOpen(true)}
        onRanking={() => setRankingOpen(true)}
      />

      {infiniteOpen && (
        <InfiniteModal
          onClose={() => setInfiniteOpen(false)}
          onFinished={() => {
            fetchRanking().then((d) => {
              if (d) { setMyRank(d.my_rank); setTotalUsers(d.total_users); setMyBest(d.my_score); setCurrentSeason(d.season); }
            });
          }}
        />
      )}
      {rankingOpen && <RankingModal onClose={() => setRankingOpen(false)} />}
      <LevelUpModal
        open={levelUpPayload !== null}
        onClose={() => setLevelUpPayload(null)}
        payload={levelUpPayload}
      />
    </div>
  );
}

// ─── 일일 퀴즈: 시작 전 ──────────────────────────────────────────────────────
function DailyStart({
  streak, accuracy, onStart, loading,
}: {
  streak: number;
  accuracy: number | null;
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col border border-outline-variant/30">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#1A237E]/10 text-[#1A237E] mb-3">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>quiz</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface mb-2">오늘의 퀴즈 챌린지</h2>
        <p className="text-sm font-medium text-on-surface-variant">매일 새로운 6문제 · 자정에 자동 갱신</p>
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
            <span className="text-lg font-bold text-on-surface tabular-nums">
              {accuracy !== null ? `${accuracy}%` : '—'}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onStart}
        disabled={loading}
        className="w-full bg-[#1A237E] text-white font-bold text-base py-4 rounded-xl shadow-sm hover:bg-[#1f2a8c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? '문제 불러오는 중...' : '오늘의 퀴즈 풀기'}
      </button>
    </div>
  );
}

// ─── 일일 퀴즈: 풀이 중 ─────────────────────────────────────────────────────
function DailySolving({
  quiz, index, total, selectedOpt, revealed, submitting, submitResult, onSelect, onNext, isLast,
}: {
  quiz: QuizQuestion;
  index: number;
  total: number;
  selectedOpt: string | null;
  revealed: boolean;
  submitting: boolean;
  submitResult: SubmitResult | null;
  onSelect: (answer: string) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const shuffledOptions = useMemo(
    () => quiz.quiz_type === 'multiple' ? [...quiz.options].sort(() => Math.random() - 0.5) : quiz.options,
    [quiz.id],
  );
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
        {shuffledOptions.map((opt, i) => {
          const isSelected = opt === selectedOpt;
          const isCorrect = revealed && submitResult ? opt === submitResult.correct_answer : false;
          const isWrong = revealed && isSelected && !isCorrect;
          let cls = 'w-full text-left p-4 rounded-xl border-2 font-medium text-base transition-all flex justify-between items-center ';
          if (!revealed) {
            cls += isSelected
              ? 'border-[#1A237E] bg-[#1A237E]/10 text-[#1A237E] font-bold'
              : submitting
              ? 'border-outline-variant/40 text-on-surface opacity-60 cursor-not-allowed'
              : 'border-outline-variant/40 text-on-surface hover:border-[#1A237E]/40 hover:bg-[#1A237E]/5 cursor-pointer';
          } else {
            if (isCorrect) cls += 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold';
            else if (isWrong) cls += 'border-red-400 bg-red-50 text-red-600 font-medium';
            else cls += 'border-outline-variant/30 text-on-surface-variant opacity-60';
          }
          return (
            <button key={i} onClick={() => onSelect(opt)} disabled={revealed || submitting} className={cls}>
              <span>
                <span className="mr-2 text-on-surface-variant">{i + 1}.</span>
                {opt}
              </span>
              {revealed && isCorrect && (
                <span className="material-symbols-outlined text-emerald-600 text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>
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
      {revealed && submitResult && (
        <div className="bg-surface-container-low rounded-xl p-4 flex gap-3 items-start mb-6">
          <span
            className="material-symbols-outlined text-[#1A237E] mt-0.5 flex-shrink-0"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            tips_and_updates
          </span>
          <div>
            <p className="text-sm font-bold text-on-surface mb-1">
              정답: {submitResult.correct_answer}
            </p>
            <p className="text-sm text-on-surface-variant leading-relaxed">{submitResult.explanation}</p>
          </div>
        </div>
      )}
      <button
        onClick={onNext}
        disabled={!revealed || submitting}
        className="w-full bg-[#1A237E] text-white font-bold text-base py-4 rounded-xl shadow-sm hover:bg-[#1f2a8c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>채점 중...</>
        ) : isLast ? (
          <>결과 보기<span className="material-symbols-outlined text-[18px]">flag</span></>
        ) : (
          <>다음 문제<span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
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
              isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
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

// ─── 시즌 챌린지 카드 ─────────────────────────────────────────────────────────
function SeasonChallengeCard({
  season, myRank, totalUsers, myBest, onStart, onRanking,
}: {
  season: number;
  myRank: number | null;
  totalUsers: number;
  myBest: number;
  onStart: () => void;
  onRanking: () => void;
}) {
  return (
    <div data-tour="season-challenge" className="bg-surface-container-low rounded-2xl border border-outline-variant/50 p-6 md:p-8 shadow-sm">
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
            SEASON {season}
          </span>
        </div>
        <p className="text-sm font-medium text-on-surface-variant">
          무한 퀴즈에 도전해 점수를 쌓고 시즌 랭킹에 이름을 올려보세요.
        </p>
      </div>

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
              {myRank !== null ? `${myRank}위` : '—'} / {totalUsers > 0 ? `${totalUsers}명` : '—'}
            </div>
          </div>
        </div>
      </div>

      <SeasonGuide />

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

// ─── 시즌 챌린지 안내 (클릭 시 펼침) ───────────────────────────────────────────
function SeasonGuide() {
  const [open, setOpen] = useState(false);
  const tiers = [
    { range: '상위 10%', exp: 200 },
    { range: '10 ~ 30%', exp: 120 },
    { range: '30 ~ 50%', exp: 70 },
    { range: '50 ~ 70%', exp: 40 },
    { range: '70% ~ (참여)', exp: 20 },
  ];
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-surface-container-low transition-colors"
      >
        <span className="material-symbols-outlined text-[#1A237E]" style={{ fontVariationSettings: '"FILL" 1' }}>
          info
        </span>
        <h3 className="text-sm md:text-base font-extrabold text-[#1A237E] flex-1">시즌 챌린지 안내</h3>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 flex flex-col gap-4 text-sm text-on-surface">
          {/* 시즌 기간 */}
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">calendar_month</span>
            <span>한 시즌은 <b>2주</b> 진행됩니다. <b>월요일 00:00</b>에 시작해 <b>2주 뒤 일요일 23:59</b>에 종료돼요.</span>
          </div>
          {/* 경험치 지급 방식 */}
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">workspace_premium</span>
            <div>
              <span>시즌 종료 시 <b>최종 랭킹 백분위</b>에 따라 경험치가 <b>자동 지급</b>됩니다.</span>
              <div className="mt-2 rounded-lg border border-outline-variant/40 overflow-hidden">
                {tiers.map((t, i) => (
                  <div
                    key={t.range}
                    className={`flex items-center justify-between px-3 py-1.5 ${i % 2 === 0 ? 'bg-surface-container-low' : ''}`}
                  >
                    <span className="text-on-surface-variant font-semibold">{t.range}</span>
                    <span className="font-black text-[#1A237E] tabular-nums">+{t.exp} EXP</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant mt-1.5">
                무한 퀴즈 최고 연속 정답 기록이 시즌 점수가 됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 무한 챌린지 모달 ────────────────────────────────────────────────────────
function InfiniteModal({ onClose, onFinished }: { onClose: () => void; onFinished: () => void }) {
  const [pool, setPool] = useState<QuizQuestion[]>([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    fetchInfinitePool().then((qs) => {
      if (qs && qs.length > 0) setPool([...qs].sort(() => Math.random() - 0.5));
      setPoolLoading(false);
    });
  }, []);

  const current = pool[idx % Math.max(pool.length, 1)];

  const shuffledOptions = useMemo(
    () => current ? (current.quiz_type === 'multiple' ? [...current.options].sort(() => Math.random() - 0.5) : current.options) : [],
    [current?.id],
  );

  const select = async (opt: string) => {
    if (revealed || submitting || !current) return;
    setSelectedOpt(opt);
    setSubmitting(true);
    const result = await checkAnswer(current.id, opt);
    setSubmitResult(result);
    setRevealed(true);
    setSubmitting(false);
    if (result?.is_correct) {
      setStreak((s) => s + 1);
    } else {
      const finalStreak = streak;
      setTimeout(async () => {
        await submitInfiniteScore(finalStreak);
        onFinished();
        setFinished(true);
      }, 1200);
    }
  };

  const next = () => {
    setSelectedOpt(null);
    setRevealed(false);
    setSubmitResult(null);
    if (idx + 1 >= pool.length) {
      setPoolLoading(true);
      setIdx(0);
      fetchInfinitePool().then((qs) => {
        if (qs && qs.length > 0) setPool([...qs].sort(() => Math.random() - 0.5));
        setPoolLoading(false);
      });
    } else {
      setIdx((i: number) => i + 1);
    }
  };

  if (poolLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-2xl p-12 flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-[#1A237E] text-[48px] animate-pulse">all_inclusive</span>
          <p className="text-base font-bold text-on-surface">문제 불러오는 중...</p>
        </div>
      </div>
    );
  }

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
            <div className="flex flex-col items-center py-2">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                현재 연속 정답
              </span>
              <span className="text-5xl font-black tracking-tight text-[#1A237E] tabular-nums">{streak}</span>
            </div>
            {current && (
              <div className="flex flex-col gap-4">
                <span className="self-start bg-[#1A237E]/10 text-[#1A237E] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  {current.category}
                </span>
                <h3 className="text-lg md:text-xl font-bold text-on-surface leading-snug">{current.question}</h3>
                <div className="flex flex-col gap-3">
                  {shuffledOptions.map((opt, i) => {
                    const isSelected = opt === selectedOpt;
                    const isCorrect = revealed && submitResult ? opt === submitResult.correct_answer : false;
                    const isWrong = revealed && isSelected && !isCorrect;
                    let cls = 'w-full text-left p-4 rounded-xl border-2 font-medium text-base transition-all flex justify-between items-center ';
                    if (!revealed) {
                      cls += isSelected
                        ? 'border-[#1A237E] bg-[#1A237E]/10 text-[#1A237E] font-bold'
                        : submitting
                        ? 'border-outline-variant/40 text-on-surface opacity-60 cursor-not-allowed'
                        : 'border-outline-variant/40 text-on-surface hover:border-[#1A237E]/40 hover:bg-[#1A237E]/5 cursor-pointer';
                    } else {
                      if (isCorrect) cls += 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold';
                      else if (isWrong) cls += 'border-red-400 bg-red-50 text-red-600';
                      else cls += 'border-outline-variant/30 text-on-surface-variant opacity-60';
                    }
                    return (
                      <button key={i} onClick={() => select(opt)} disabled={revealed || submitting} className={cls}>
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
                {revealed && submitResult?.is_correct && (
                  <button
                    onClick={next}
                    className="w-full bg-[#1A237E] text-white font-bold text-base py-3 rounded-xl hover:bg-[#1f2a8c] transition-colors flex items-center justify-center gap-2"
                  >
                    다음 문제
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                )}
              </div>
            )}
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
                  setSubmitResult(null);
                  setPoolLoading(true);
                  fetchInfinitePool().then((qs) => {
                    if (qs && qs.length > 0) setPool([...qs].sort(() => Math.random() - 0.5));
                    setPoolLoading(false);
                  });
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
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRanking().then((d) => { setData(d); setLoading(false); });
  }, []);

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
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">시즌 {data?.season ?? '—'} 랭킹</h2>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface p-2 rounded-full transition-colors"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <span className="material-symbols-outlined text-[#1A237E] text-[48px] animate-pulse">leaderboard</span>
          </div>
        ) : !data || data.entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <span className="material-symbols-outlined text-on-surface-variant text-[48px]">emoji_events</span>
            <p className="text-base font-bold text-on-surface-variant">아직 참여자가 없습니다</p>
            <p className="text-sm text-on-surface-variant/70">무한 퀴즈에 도전해 첫 번째 순위를 차지하세요!</p>
          </div>
        ) : (
          <>
            {/* 내 순위 하이라이트 */}
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <div className="bg-[#1A237E] text-white rounded-xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-300 opacity-20 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="flex flex-col items-center justify-center min-w-[40px]">
                    <span className="text-sm font-bold text-white/60 tabular-nums">
                      {data.my_rank !== null ? `${data.my_rank}위` : '—'}
                    </span>
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
                    <span className="text-base font-bold">내 기록</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60 mt-0.5">내 순위</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 relative z-10">
                  <span className="text-2xl font-black tabular-nums">{data.my_score.toLocaleString()}</span>
                  <span className="text-sm text-white/60">점</span>
                </div>
              </div>
            </div>

            {/* 랭킹 리스트 */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2 space-y-1">
              {data.entries.map((e, i) => {
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
                    <div
                      className={`flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-colors mx-2 group ${
                        e.is_me ? 'bg-[#1A237E]/5' : ''
                      }`}
                    >
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
                          {e.nickname}{e.is_me ? ' (나)' : ''}
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
          </>
        )}

        {/* 하단 fade gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-surface-container-lowest to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
