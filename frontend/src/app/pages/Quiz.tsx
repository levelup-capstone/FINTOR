import { useEffect, useState } from 'react';
import {
  fetchTodayQuiz,
  fetchQuizStatus,
  submitAnswer,
  type QuizQuestion,
  type SubmitResult,
  type QuizStatus,
} from './quizApi';

type View = 'home' | 'play' | 'result';

// ─── 홈 화면 ───────────────────────────────────────────────────────────────
function QuizHome({
  status,
  onStart,
  loading,
}: {
  status: QuizStatus | null;
  onStart: () => void;
  loading: boolean;
}) {
  const masteredPct = status ? Math.round((status.mastered / status.total_questions) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="w-full bg-[#1A237E]/20 rounded-2xl p-6 h-36 animate-pulse" />
        <div className="w-full bg-surface-container-lowest rounded-2xl p-6 h-28 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 히어로 카드 */}
      <div className="relative w-full bg-[#1A237E] text-white rounded-2xl p-6 overflow-hidden shadow-sm">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent_60%)] pointer-events-none" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-400 rounded-full opacity-20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[28px]"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                quiz
              </span>
              <h2 className="text-2xl font-black tracking-tight">경제 퀴즈</h2>
            </div>
            <p className="text-white/70 text-sm">
              경제 상식을 쌓아보세요.
            </p>
          </div>

          <div className="z-10 w-full md:w-auto">
            <button
              onClick={onStart}
              className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-5 py-4 backdrop-blur-sm hover:bg-white/20 transition-all cursor-pointer w-full md:w-auto"
            >
              <span className="material-symbols-outlined text-[28px]">play_circle</span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">시작</span>
                <span className="text-lg font-black">퀴즈 풀기</span>
              </div>
              <span className="material-symbols-outlined text-white/60 ml-auto">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* 학습 통계 */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            icon="library_books"
            label="전체 문제"
            value={`${status.total_questions}문제`}
          />
          <StatCard
            icon="school"
            label="풀어본 문제"
            value={`${status.attempted}문제`}
          />
          <StatCard
            icon="stars"
            label="숙달 문제"
            value={`${status.mastered}문제`}
            sub={`전체의 ${masteredPct}%`}
            highlight
          />
        </div>
      )}

      {/* 가중치 시스템 안내 */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#1A237E]">info</span>
          반복 학습 시스템
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
          <WeightBadge label="처음 보는 문제" color="bg-blue-100 text-blue-700" />
          <WeightBadge label="틀린 문제 → 자주 출제" color="bg-red-100 text-red-700" />
          <WeightBadge label="맞힌 문제 → 가끔 출제" color="bg-emerald-100 text-emerald-700" />
          <WeightBadge label="3회 연속 정답 → 숙달" color="bg-purple-100 text-purple-700" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 flex flex-col gap-1 border ${
        highlight
          ? 'bg-[#1A237E]/5 border-[#1A237E]/20'
          : 'bg-surface-container-lowest border-outline-variant/30'
      }`}
    >
      <span
        className={`material-symbols-outlined text-[22px] ${highlight ? 'text-[#1A237E]' : 'text-on-surface-variant'}`}
        style={{ fontVariationSettings: '"FILL" 1' }}
      >
        {icon}
      </span>
      <span className="text-xs text-on-surface-variant font-medium">{label}</span>
      <span className="text-xl font-black">{value}</span>
      {sub && <span className="text-xs text-on-surface-variant">{sub}</span>}
    </div>
  );
}

function WeightBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`${color} rounded-lg px-3 py-2 font-semibold text-center`}>{label}</span>
  );
}

// ─── 풀이 화면 ───────────────────────────────────────────────────────────────
function QuizPlay({
  questions,
  onFinish,
}: {
  questions: QuizQuestion[];
  onFinish: (results: { question: QuizQuestion; result: SubmitResult }[]) => void;
}) {
  const unsolved = questions.filter((q) => !q.is_solved);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionResults, setSessionResults] = useState<{ question: QuizQuestion; result: SubmitResult }[]>([]);
  const [finished, setFinished] = useState(false);

  const current = unsolved[index];

  useEffect(() => {
    if (finished) {
      onFinish(sessionResults);
    }
  }, [finished]);

  if (!current && !finished) {
    setFinished(true);
    return null;
  }

  if (!current) return null;

  const isOx = current.quiz_type === 'ox';
  const answered = submitResult !== null;

  const handleSelect = (opt: string) => {
    if (answered) return;
    setSelected(opt);
  };

  const handleSubmit = async () => {
    if (!selected || submitting || answered) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await submitAnswer(current.id, selected);
    setSubmitting(false);
    if (res) {
      setSubmitResult(res);
      setSessionResults((prev) => [...prev, { question: current, result: res }]);
    } else {
      setSubmitError('제출에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const handleNext = () => {
    if (index + 1 >= unsolved.length) {
      onFinish([...sessionResults]);
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setSubmitResult(null);
    }
  };

  const totalUnsolved = unsolved.length;
  const progressPct = Math.round(((index + (answered ? 1 : 0)) / totalUnsolved) * 100);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* 진행 상단 */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm text-on-surface-variant font-semibold">
          <span>{index + 1} / {totalUnsolved} 문제</span>
          <span className="bg-[#1A237E]/10 text-[#1A237E] px-3 py-1 rounded-full text-xs font-bold">
            {current.category}
          </span>
        </div>
        <div className="w-full h-2 bg-outline-variant/30 rounded-full overflow-hidden">
          <div
            className="bg-[#1A237E] h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-sm">
        <div className="flex items-start gap-3 mb-6">
          <span
            className="material-symbols-outlined text-[#1A237E] text-[24px] mt-0.5 shrink-0"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            help
          </span>
          <p className="text-base md:text-lg font-bold leading-relaxed">{current.question}</p>
        </div>

        {/* 선택지 */}
        <div className={`grid gap-3 ${isOx ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {current.options.map((opt) => {
            const isSelected = selected === opt;
            const isCorrect = answered && opt === submitResult?.correct_answer;
            const isWrong = answered && isSelected && !submitResult?.is_correct;

            let cls =
              'w-full text-left rounded-xl px-4 py-3 font-semibold text-sm border-2 transition-all duration-200 ';

            if (!answered) {
              cls += isSelected
                ? 'border-[#1A237E] bg-[#1A237E]/10 text-[#1A237E]'
                : 'border-outline-variant/40 bg-surface hover:border-[#1A237E]/40 hover:bg-[#1A237E]/5 cursor-pointer';
            } else {
              if (isCorrect) {
                cls += 'border-emerald-500 bg-emerald-50 text-emerald-700';
              } else if (isWrong) {
                cls += 'border-red-400 bg-red-50 text-red-600';
              } else {
                cls += 'border-outline-variant/30 bg-surface text-on-surface-variant opacity-60';
              }
            }

            return (
              <button key={opt} className={cls} onClick={() => handleSelect(opt)} disabled={answered}>
                <div className="flex items-center gap-2">
                  {answered && isCorrect && (
                    <span
                      className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0"
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      check_circle
                    </span>
                  )}
                  {answered && isWrong && (
                    <span
                      className="material-symbols-outlined text-[18px] text-red-500 shrink-0"
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      cancel
                    </span>
                  )}
                  <span>{opt}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 정답 해설 */}
      {answered && submitResult && (
        <div
          className={`rounded-2xl p-5 border-2 ${
            submitResult.is_correct
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`material-symbols-outlined text-[22px] ${submitResult.is_correct ? 'text-emerald-600' : 'text-red-500'}`}
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              {submitResult.is_correct ? 'check_circle' : 'cancel'}
            </span>
            <span
              className={`font-black text-base ${submitResult.is_correct ? 'text-emerald-700' : 'text-red-600'}`}
            >
              {submitResult.is_correct ? '정답입니다!' : '오답입니다.'}
            </span>
            {submitResult.correct_streak >= 3 && (
              <span className="ml-auto bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">
                🎯 숙달
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">{submitResult.explanation}</p>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-2">
        {submitError && (
          <p className="text-red-500 text-xs text-center font-semibold">{submitError}</p>
        )}
        {!answered ? (
          <button
            onClick={() => { void handleSubmit(); }}
            disabled={!selected || submitting}
            className="flex-1 bg-[#1A237E] text-white rounded-xl py-3 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1f2a8c] transition-colors"
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex-1 bg-[#1A237E] text-white rounded-xl py-3 font-bold text-sm hover:bg-[#1f2a8c] transition-colors flex items-center justify-center gap-2"
          >
            {index + 1 >= totalUnsolved ? (
              <>
                <span>결과 보기</span>
                <span className="material-symbols-outlined text-[18px]">flag</span>
              </>
            ) : (
              <>
                <span>다음 문제</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 결과 화면 ───────────────────────────────────────────────────────────────
function QuizResult({
  results,
  onBack,
}: {
  results: { question: QuizQuestion; result: SubmitResult }[];
  onBack: () => void;
}) {
  const correctCount = results.filter((r) => r.result.is_correct).length;
  const total = results.length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const emoji = pct === 100 ? '🎉' : pct >= 60 ? '👍' : '💪';
  const message =
    pct === 100
      ? '완벽한 점수! 오늘의 퀴즈를 모두 맞혔어요.'
      : pct >= 60
      ? '훌륭해요! 틀린 문제는 다음에 다시 출제될 거예요.'
      : '조금 더 힘내봐요! 틀린 문제는 자주 다시 출제됩니다.';

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* 결과 요약 */}
      <div className="bg-[#1A237E] text-white rounded-2xl p-6 text-center overflow-hidden relative">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <span className="text-5xl">{emoji}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black">{correctCount}</span>
            <span className="text-2xl font-semibold text-white/60">/ {total}</span>
          </div>
          <span className="text-white/70 text-sm">{pct}% 정답</span>
          <p className="text-sm font-semibold text-white/80 mt-1">{message}</p>
        </div>
      </div>

      {/* 문제별 결과 */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-sm text-on-surface-variant">문제별 결과</h3>
        {results.map(({ question, result }, i) => (
          <div
            key={question.id}
            className={`rounded-2xl p-4 border-2 ${
              result.is_correct
                ? 'bg-emerald-50 border-emerald-100'
                : 'bg-red-50 border-red-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                  result.is_correct ? 'text-emerald-600' : 'text-red-500'
                }`}
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                {result.is_correct ? 'check_circle' : 'cancel'}
              </span>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-on-surface-variant">Q{i + 1}.</span>
                  <span className="bg-[#1A237E]/10 text-[#1A237E] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {question.category}
                  </span>
                  {result.correct_streak >= 3 && (
                    <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      숙달
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug">{question.question}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                  {result.explanation}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 뒤로 버튼 */}
      <button
        onClick={onBack}
        className="w-full bg-[#1A237E] text-white rounded-xl py-3 font-bold text-sm hover:bg-[#1f2a8c] transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">home</span>
        퀴즈 홈으로
      </button>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function Quiz() {
  const [view, setView] = useState<View>('home');
  const [playQuestions, setPlayQuestions] = useState<QuizQuestion[]>([]);
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sessionResults, setSessionResults] = useState<{ question: QuizQuestion; result: SubmitResult }[]>([]);

  const loadStatus = async () => {
    setLoading(true);
    const stat = await fetchQuizStatus();
    setStatus(stat);
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleStart = async () => {
    setStarting(true);
    const data = await fetchTodayQuiz();
    setStarting(false);
    if (data && data.questions.length > 0) {
      setPlayQuestions(data.questions);
      setView('play');
    }
  };

  const handleFinish = (results: { question: QuizQuestion; result: SubmitResult }[]) => {
    setSessionResults(results);
    setView('result');
  };

  const handleBack = () => {
    setView('home');
    loadStatus();
  };

  if (view === 'play') {
    return (
      <QuizPlay
        questions={playQuestions}
        onFinish={handleFinish}
      />
    );
  }

  if (view === 'result') {
    return <QuizResult results={sessionResults} onBack={handleBack} />;
  }

  return (
    <QuizHome
      status={status}
      onStart={handleStart}
      loading={loading || starting}
    />
  );
}
