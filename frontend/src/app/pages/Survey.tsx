import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

// 투자 성향 레벨별 정보
const riskLevelInfo: Record<number, { label: string; color: string; icon: string; description: string }> = {
  1: { label: '안정형',     color: '#10B981', icon: 'shield',         description: '원금 보존을 최우선으로 하며 안전한 자산 위주로 투자합니다.' },
  2: { label: '안정추구형', color: '#3B82F6', icon: 'verified_user',  description: '안정성을 추구하면서 소폭의 수익도 기대하는 유형입니다.' },
  3: { label: '위험중립형', color: '#8B5CF6', icon: 'balance',        description: '위험과 수익 사이에서 균형 잡힌 투자를 선호합니다.' },
  4: { label: '적극투자형', color: '#F97316', icon: 'trending_up',    description: '수익을 위해 어느 정도의 위험을 기꺼이 감수하는 유형입니다.' },
  5: { label: '공격투자형', color: '#EF4444', icon: 'local_fire_department', description: '고수익을 목표로 높은 위험도 과감하게 수용합니다.' },
};

const questions = [
  { id: 'age', title: '연령대를 선택해주세요', options: ['20대 미만','20대', '30대', '40대', '50대', '60대 이상'] },
  { id: 'experience', title: '투자 경력은 얼마나 되시나요?', options: ['없음', '6개월 미만', '6개월-1년', '1-3년', '3-5년', '5년 이상'] },
  { id: 'period', title: '선호하는 투자 기간은?', options: ['단기 (6개월 미만)', '중단기 (6개월-3년)', '중장기 (3년-5년)', '장기 (5년 이상)'] },
  { id: 'assetType', title: '선호하는 자산 종류는?', options: ['성장주', 'ETF', '배당형 우량주', '예적금', '채권', '코인', '현금', '금'] },
  { id: 'risk', title: '감수 가능한 리스크 정도는?', options: ['원금 손실이 거의 없어야 마음이 편하다.', '약간의 수익은 원하지만 손실엔 민감하다.', '높은 수익을 위해 위험도 일부 감수할 수 있다.', '변동성에 대한 두려움이 거의 없고 공격적으로 접근하는 편이다.'] },
  { id: 'investAmount', title: '투자 가능한 자산 규모는?', options: ['500만원 미만', '500만원-1천만원', '1천만원-5천만원', '5천만원-1억', '1억-3억', '3억 이상'] },
  { id: 'income', title: '월 소득 수준은?', options: ['200만원 미만', '200-400만원', '400-600만원', '600-800만원', '800-1000만원', '1000만원 이상'] },
  { id: 'goal', title: '투자 목적은 무엇인가요?', options: ['노후 준비', '자산 증식', '자녀 교육', '주택 마련', '여유 자금 운용', '기타'] },
];

export function Survey() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showRiskResult, setShowRiskResult] = useState(false);
  const [riskLevel, setRiskLevel] = useState<number | null>(null);
  const [riskLabel, setRiskLabel] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('surveyAnswers');
    if (saved) setAnswers(JSON.parse(saved));
  }, []);

  const isMultiStep = questions[currentStep].id === 'assetType';

  useEffect(() => {
    const saved = answers[questions[currentStep].id];
    if (questions[currentStep].id === 'assetType') {
      setSelectedOptions(Array.isArray(saved) ? saved : []);
      setSelectedOption(null);
    } else {
      setSelectedOption(typeof saved === 'string' ? saved : null);
      setSelectedOptions([]);
    }
  }, [currentStep, answers]);

  const handleOptionClick = (option: string) => {
    if (isMultiStep) {
      setSelectedOptions((prev) => {
        if (prev.includes(option)) return prev.filter((o) => o !== option);
        if (prev.length >= 3) return prev;
        return [...prev, option];
      });
    } else {
      setSelectedOption(option);
    }
  };

  const canProceed = isMultiStep ? selectedOptions.length > 0 : !!selectedOption;

  const handleNext = () => {
    if (!canProceed) return;
    const value = isMultiStep ? selectedOptions : selectedOption!;
    const newAnswers = { ...answers, [questions[currentStep].id]: value };
    setAnswers(newAnswers);
    localStorage.setItem('surveyAnswers', JSON.stringify(newAnswers));
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setIsCompleted(false);
    setShowRiskResult(false);
    setRiskLevel(null);
    setRiskLabel('');
    setCurrentStep(0);
    setAnswers({});
    setSelectedOption(null);
    localStorage.removeItem('surveyAnswers');
  };

  // ── API enum 매핑 ─────────────────────────────────────────────────────────
  const ageGroupMap: Record<string, string> = {
    '20대 미만': 'under-20',
    '20대': '20y',
    '30대': '30y',
    '40대': '40y',
    '50대': '50y',
    '60대 이상': 'over-60',
  };
  const experienceMap: Record<string, string> = {
    '없음': 'none',
    '6개월 미만': 'under-6m',
    '6개월-1년': '6m-1y',
    '1-3년': '1y-3y',
    '3-5년': '3y-5y',
    '5년 이상': 'over-5y',
  };
  const periodMap: Record<string, string> = {
    '단기 (6개월 미만)': 'short',
    '중단기 (6개월-3년)': 's-mid',
    '중장기 (3년-5년)': 'm-long',
    '장기 (5년 이상)': 'long',
  };
  const assetMap: Record<string, string> = {
    '성장주': 'growth-stock',
    'ETF': 'etf',
    '배당형 우량주': 'bluechip-stock',
    '예적금': 'deposit',
    '채권': 'bonds',
    '코인': 'coin',
    '현금': 'krw',
    '금': 'gold',
  };
  const riskMap: Record<string, string> = {
    '원금 손실이 거의 없어야 마음이 편하다.': 'v-low',
    '약간의 수익은 원하지만 손실엔 민감하다.': 'low',
    '높은 수익을 위해 위험도 일부 감수할 수 있다.': 'high',
    '변동성에 대한 두려움이 거의 없고 공격적으로 접근하는 편이다.': 'v-high',
  };
  const investAmountMap: Record<string, string> = {
    '500만원 미만': 'under-500',
    '500만원-1천만원': '500-1000',
    '1천만원-5천만원': '1000-5000',
    '5천만원-1억': '5000-1m',
    '1억-3억': '1m-3m',
    '3억 이상': 'over_3m',
  };
  const incomeMap: Record<string, string> = {
    '200만원 미만': 'under-200',
    '200-400만원': '200-400',
    '400-600만원': '400-600',
    '600-800만원': '600-800',
    '800-1000만원': '800-1000',
    '1000만원 이상': 'over-1000',
  };
  const goalMap: Record<string, string> = {
    '노후 준비': 'retirement',
    '자산 증식': 'growth',
    '자녀 교육': 'saving',
    '주택 마련': 'home-ownership',
    '여유 자금 운용': 'investment-management',
    '기타': 'others',
  };

  // 설문 payload 빌드
  const buildPayload = () => {
    const assetTypeRaw = answers['assetType'];
    return {
      age_group: ageGroupMap[answers['age'] as string],
      investment_experience: experienceMap[answers['experience'] as string],
      preferred_period: periodMap[answers['period'] as string],
      preferred_assets: (Array.isArray(assetTypeRaw) ? assetTypeRaw : [assetTypeRaw])
        .map((a) => assetMap[a]).filter(Boolean),
      risk_type: riskMap[answers['risk'] as string],
      investment_assets: investAmountMap[answers['investAmount'] as string],
      monthly_income: incomeMap[answers['income'] as string],
      investment_goal: goalMap[answers['goal'] as string],
    };
  };

  // 설문 제출 → 성향 결과 화면으로 이동
  const handleSubmitSurvey = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:8000/api/survey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setRiskLevel(data.data.risk_level);
        setRiskLabel(data.data.risk_label);
        setShowRiskResult(true);
        localStorage.removeItem('surveyAnswers');
      } else {
        console.error('설문 제출 오류:', data);
      }
    } catch (e) {
      console.error('설문 제출 실패:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 성향 결과 확인 → 대시보드 이동
  const handleGoToDashboard = () => {
    navigate('/dashboard', { replace: true });
  };

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  // ── 성향 결과 화면 ──────────────────────────────────────────────────────
  if (showRiskResult && riskLevel !== null) {
    const info = riskLevelInfo[riskLevel];
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-xl">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 px-8 py-14 md:px-14 md:py-20 flex flex-col items-center text-center gap-8">
            {/* 성향 아이콘 */}
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full shadow-lg" style={{ backgroundColor: info.color }}>
              <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: '"FILL" 1, "wght" 700' }}>
                {info.icon}
              </span>
            </div>

            {/* 결과 텍스트 */}
            <div className="space-y-3">
              <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">나의 투자 성향</p>
              <h1 className="text-3xl md:text-4xl font-black font-headline tracking-tight dark:text-white" style={{ color: info.color }}>
                {riskLabel}
              </h1>
              <p className="text-base md:text-lg text-on-surface-variant font-medium leading-relaxed">
                {info.description}
              </p>
            </div>

            {/* 레벨 인디케이터 */}
            <div className="w-full bg-surface-container-low rounded-xl p-5 border border-outline-variant/20">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">투자 성향 레벨</p>
              <div className="flex items-center justify-between gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <div key={lvl} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className="w-full h-2 rounded-full transition-all"
                      style={{ backgroundColor: lvl <= riskLevel ? info.color : '#E2E8F0' }}
                    />
                    <span className={`text-[10px] font-bold ${lvl === riskLevel ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
                      {riskLevelInfo[lvl].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 버튼 */}
            <button
              onClick={handleGoToDashboard}
              className="w-full px-10 py-3.5 rounded-xl font-bold text-base md:text-lg bg-[#1A237E] text-white transition-all duration-200 hover:bg-[#1A237E]/90 hover:scale-105 hover:shadow-[0_0_20px_rgba(26,35,126,0.3)] active:scale-95 flex items-center justify-center gap-2"
            >
              대시보드로 이동
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 설문 완료 화면 ────────────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-3xl">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden">
            {/* 진행 바 100% */}
            <div className="w-full h-3 bg-slate-200 dark:bg-slate-700">
              <div className="h-full bg-[#1A237E] transition-all duration-500 ease-out" style={{ width: '100%' }} />
            </div>

            <div className="px-6 py-10 md:px-10 md:py-14">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#1A237E] shadow-lg">
                    <span className="material-symbols-outlined text-white text-3xl md:text-4xl" style={{ fontVariationSettings: '"FILL" 1, "wght" 700' }}>check_circle</span>
                  </div>
                </div>
                <h1 className="text-2xl md:text-4xl font-black font-headline tracking-tight text-[#1A237E] dark:text-white mb-2">
                  설문이 완료되었습니다!
                </h1>
                <p className="text-sm md:text-base text-on-surface-variant font-bold">소중한 응답 감사드립니다.</p>
              </div>

              {/* 답변 요약 */}
              <div className="bg-surface-container-low rounded-xl p-5 md:p-6 border border-outline-variant/20 mb-8">
                <h2 className="text-base md:text-lg font-extrabold font-headline text-[#1A237E] dark:text-indigo-200 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">assignment</span>
                  응답 요약
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {questions.map((question, index) => (
                    <div key={question.id} className="bg-surface-container-lowest rounded-xl p-3 md:p-4 border border-outline-variant/20">
                      <p className="text-[15px] font-extrabold text-[#1A237E] uppercase tracking-wide mb-1">질문 {index + 1}</p>
                      <p className="text-sm md:text-sm font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">{question.title}</p>
                      <p className="text-sm md:text-base font-black text-[#1A237E] dark:text-indigo-200">
                        {Array.isArray(answers[question.id])
                          ? (answers[question.id] as string[]).join(' · ')
                          : answers[question.id]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleRestart}
                  className="w-full md:w-auto px-6 py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 border-2 border-[#1A237E] text-[#1A237E] hover:bg-[#1A237E] hover:text-white active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  다시 시작
                </button>
                <button
                  onClick={handleSubmitSurvey}
                  disabled={isSubmitting}
                  className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                    isSubmitting
                      ? 'bg-[#1A237E]/60 text-white cursor-not-allowed'
                      : 'bg-[#1A237E] text-white hover:bg-[#1A237E]/90 hover:scale-105 hover:shadow-[0_0_20px_rgba(26,35,126,0.3)] hover:gap-3 active:scale-95'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      분석 중...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">psychology</span>
                      나의 투자 성향 확인하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 인트로 화면 ──────────────────────────────────────────────────────────
  if (showIntro) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-xl">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 px-8 py-14 md:px-14 md:py-20 flex flex-col items-center text-center gap-8">
            {/* 아이콘 */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#1A237E] shadow-lg">
              <span className="material-symbols-outlined text-white text-4xl">assignment</span>
            </div>

            {/* 텍스트 */}
            <div className="space-y-4">
              <h1 className="text-2xl md:text-3xl font-black font-headline tracking-tight text-[#1A237E] dark:text-white leading-tight">
                저희 서비스에 처음 오셨군요!
              </h1>
              <p className="text-base md:text-lg text-on-surface-variant font-bold leading-relaxed">
                Fintor는 사용자의 투자 유형에 따라<br className="hidden md:block" /> 자산을 구성해드립니다.<br />
                간단한 설문을 시작합니다.
              </p>
            </div>

            {/* 버튼 */}
            <button
              onClick={() => setShowIntro(false)}
              className="px-10 py-3.5 rounded-xl font-bold text-base md:text-lg bg-[#1A237E] text-white transition-all duration-200 hover:bg-[#1A237E]/90 hover:scale-105 hover:shadow-[0_0_20px_rgba(26,35,126,0.3)] active:scale-95 flex items-center gap-2"
            >
              시작하기
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 설문 질문 화면 ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-3xl">
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden">
          {/* 진행 바 */}
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-700">
            <div className="h-full bg-[#1A237E] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>

          <div className="px-6 py-10 md:px-10 md:py-12">
            {/* 진행 상태 */}
            <div className="text-center mb-8">
              <span className="inline-block px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[15px] font-bold tracking-widest uppercase mb-4">
                질문 {currentStep + 1} / {questions.length}
              </span>
              <h1 className="text-xl md:text-3xl font-black font-headline tracking-tight text-[#1A237E] dark:text-white mb-4 leading-tight">
                {currentQuestion.title}
              </h1>
              <div className="flex items-center justify-center gap-1.5 md:gap-2">
                {questions.map((_, index) => (
                  <div key={index} className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${
                    index === currentStep ? 'w-6 md:w-8 bg-[#1A237E]'
                    : index < currentStep ? 'w-1.5 md:w-2 bg-[#1A237E]'
                    : 'w-1.5 md:w-2 bg-slate-300'
                  }`} />
                ))}
              </div>
            </div>

            {/* 다중 선택 안내 */}
            {isMultiStep && (
              <p className="text-sl font-bold text-on-surface-variant text-center mb-5">
                최대 3가지 선택 ({selectedOptions.length} / 3)
              </p>
            )}

            {/* 옵션 카드 */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {currentQuestion.options.map((option, index) => {
                const isSelected = isMultiStep ? selectedOptions.includes(option) : selectedOption === option;
                const isDisabled = isMultiStep && !isSelected && selectedOptions.length >= 3;
                return (
                  <button
                    key={index}
                    onClick={() => handleOptionClick(option)}
                    disabled={isDisabled}
                    className={`group relative p-4 md:p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                      isSelected
                        ? 'border-[#1A237E] bg-surface-container-low shadow-md'
                        : isDisabled
                        ? 'border-outline-variant/20 bg-surface-container-low opacity-40 cursor-not-allowed'
                        : 'border-outline-variant/30 bg-surface-container-low hover:border-[#1A237E]/40 hover:shadow-sm'
                    }`}
                  >
                    <div className={`absolute -top-2 -left-2 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs md:text-sm font-bold transition-all ${
                      isSelected
                        ? 'bg-[#1A237E] text-white shadow-sm'
                        : 'bg-slate-100 text-on-surface-variant group-hover:bg-[#1A237E]/10 group-hover:text-[#1A237E]'
                    }`}>
                      {isMultiStep && isSelected ? selectedOptions.indexOf(option) + 1 : index + 1}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs md:text-base font-bold transition-colors ${
                        isSelected ? 'text-[#1A237E]' : 'text-on-surface-variant group-hover:text-[#1A237E]'
                      }`}>
                        {option}
                      </span>
                      <div className={`w-5 h-5 md:w-6 md:h-6 ${isMultiStep ? 'rounded-md' : 'rounded-full'} border-2 transition-all flex items-center justify-center flex-shrink-0 ml-2 ${
                        isSelected
                          ? 'border-[#1A237E] bg-[#1A237E]'
                          : 'border-outline-variant group-hover:border-[#1A237E]'
                      }`}>
                        {isSelected && (
                          <span className="material-symbols-outlined text-white text-xs" style={{ fontVariationSettings: '"FILL" 1, "wght" 700' }}>check</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 이전 / 다음 */}
            <div className="flex items-center justify-between">
              {currentStep > 0 ? (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 md:px-6 py-2 md:py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center gap-1.5 border-2 border-[#1A237E] text-[#1A237E] hover:bg-[#1A237E] hover:text-white active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  이전
                </button>
              ) : <div />}
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center gap-1.5 active:scale-95 ${
                  canProceed
                    ? 'bg-[#1A237E] text-white hover:bg-[#1A237E]/90 hover:scale-105 hover:shadow-[0_0_20px_rgba(26,35,126,0.3)] hover:gap-2.5'
                    : 'bg-surface-container-low text-slate-300 cursor-not-allowed'
                }`}
              >
                {currentStep === questions.length - 1 ? '완료' : '다음'}
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
