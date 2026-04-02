import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// 💡 백엔드 enum 값을 한글명으로 매핑
const assetNameMap: Record<string, string> = {
  'growth-stock': '성장주',
  'etf': 'ETF',
  'bluechip-stock': '배당형 우량주',
  'deposit': '예적금',
  'bonds': '채권',
  'coin': '코인',
  'krw': '원화',
  'gold': '금',
};

// 💡 차트를 위한 색상 매핑
const assetColorMap: Record<string, string> = {
  'growth-stock': '#ef4444', // 빨강
  'bluechip-stock': '#1A237E', // 딥블루
  'etf': '#3b82f6', // 라이트블루
  'deposit': '#10b981', // 초록
  'bonds': '#8b5cf6', // 보라
  'coin': '#f59e0b', // 주황
  'krw': '#9ca3af', // 회색
  'gold': '#eab308', // 노랑
};

// 💡 백엔드 API 명세에 맞춘 Enum 데이터 맵
const ageGroupMap: Record<string, string> = {
  '20대 미만': 'under-20', '20대': '20y', '30대': '30y', '40대': '40y', '50대': '50y', '60대 이상': 'over-60',
};
const experienceMap: Record<string, string> = {
  '없음': 'none', '6개월 미만': 'under-6m', '6개월-1년': '6m-1y', '1-3년': '1y-3y', '3-5년': '3y-5y', '5년 이상': 'over-5y',
};
const periodMap: Record<string, string> = {
  '단기 (6개월 미만)': 'short', '중단기 (6개월-3년)': 's-mid', '중장기 (3년-5년)': 'm-long', '장기 (5년 이상)': 'long',
};
const assetMap: Record<string, string> = {
  '성장주': 'growth-stock', 'ETF': 'etf', '배당형 우량주': 'bluechip-stock', '예적금': 'deposit', '채권': 'bonds', '코인': 'coin', '현금': 'krw', '금': 'gold',
};
const riskMap: Record<string, string> = {
  '원금 손실이 거의 없어야 마음이 편하다.': 'v-low', '약간의 수익은 원하지만 손실엔 민감': 'low', '높은 수익을 위해 위험도 일부 감수': 'high', '변동성에 대한 두려움이 거의 없고 공격적으로 접근': 'v-high',
};
const investAmountMap: Record<string, string> = {
  '500만원 미만': 'under-500', '500만원-1천만원': '500-1000', '1천만원-5천만원': '1000-5000', '5천만원-1억': '5000-1m', '1억-3억': '1m-3m', '3억 이상': 'over-3m',
};
const incomeMap: Record<string, string> = {
  '200만원 미만': 'under-200', '200-400만원': '200-400', '400-600만원': '400-600', '600-800만원': '600-800', '800-1000만원': '800-1000', '1000만원 이상': 'over-1000',
};
const goalMap: Record<string, string> = {
  '노후 준비': 'retirement', '자산 증식': 'growth', '자녀 교육': 'saving', '주택 마련': 'home-ownership', '여유 자금 운용': 'investment-management', '기타': 'others',
};

const questions = [
  { id: 'age', title: '연령대를 선택해주세요', options: ['20대 미만','20대', '30대', '40대', '50대', '60대 이상'] },
  { id: 'experience', title: '투자 경력은 얼마나 되시나요?', options: ['없음', '6개월 미만', '6개월-1년', '1-3년', '3-5년', '5년 이상'] },
  { id: 'period', title: '선호하는 투자 기간은?', options: ['단기 (6개월 미만)', '중단기 (6개월-3년)', '중장기 (3년-5년)', '장기 (5년 이상)'] },
  { id: 'assetType', title: '선호하는 자산 종류는?', options: ['성장주', 'ETF', '배당형 우량주', '예적금', '채권', '코인', '현금', '금'] },
  { id: 'risk', title: '감수 가능한 리스크 정도는?', options: ['원금 손실이 거의 없어야 마음이 편하다.', '약간의 수익은 원하지만 손실엔 민감', '높은 수익을 위해 위험도 일부 감수', '변동성에 대한 두려움이 거의 없고 공격적으로 접근'] },
  { id: 'investAmount', title: '투자 가능한 자산 규모는?', options: ['500만원 미만', '500만원-1천만원', '1천만원-5천만원', '5천만원-1억', '1억-3억', '3억 이상'] },
  { id: 'income', title: '월 소득 수준은?', options: ['200만원 미만', '200-400만원', '400-600만원', '600-800만원', '800-1000만원', '1000만원 이상'] },
  { id: 'goal', title: '투자 목적은 무엇인가요?', options: ['노후 준비', '자산 증식', '자녀 교육', '주택 마련', '여유 자금 운용', '기타'] },
];

// 백엔드로부터 전달받아 변환할 포트폴리오 타입
type Portfolio = {
  id: string;
  name: string;
  allocations: { asset: string; ratio: number }[];
  chartData: { name: string; value: number; color: string }[];
  assets: string;
  chartColor: string;
};

export function Survey() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showPortfolioSelection, setShowPortfolioSelection] = useState(false);
  
  // 💡 백엔드 통신 후 받아올 포트폴리오 상태 관리
  const [fetchedPortfolios, setFetchedPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
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

  const handleNext = async () => {
    if (!canProceed) return;
    const value = isMultiStep ? selectedOptions : selectedOption!;
    const currentAnswers = { ...answers, [questions[currentStep].id]: value };
    
    setAnswers(currentAnswers);
    localStorage.setItem('surveyAnswers', JSON.stringify(currentAnswers));
    
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // 💡 [핵심 로직] 설문 마지막 단계에서 백엔드로 데이터 전송 후 포트폴리오 응답 받기
      setIsSubmitting(true);
      const assetTypeRaw = currentAnswers['assetType'];
      
      const payload = {
        age_group: ageGroupMap[currentAnswers['age'] as string],
        investment_experience: experienceMap[currentAnswers['experience'] as string],
        preferred_period: periodMap[currentAnswers['period'] as string],
        preferred_assets: (Array.isArray(assetTypeRaw) ? assetTypeRaw : [assetTypeRaw])
          .map((a) => assetMap[a]).filter(Boolean),
        risk_type: riskMap[currentAnswers['risk'] as string],
        investment_assets: investAmountMap[currentAnswers['investAmount'] as string],
        monthly_income: incomeMap[currentAnswers['income'] as string],
        investment_goal: goalMap[currentAnswers['goal'] as string],
      };

      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('http://localhost:8000/api/survey', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        
        if (res.ok && data.success && data.data?.portfolios) {
          // 백엔드 데이터를 차트용 포맷으로 변환
          const mappedPortfolios: Portfolio[] = data.data.portfolios.map((p: any) => ({
            ...p,
            chartData: p.allocations.map((a: any) => ({
              name: a.asset,
              value: a.ratio,
              color: assetColorMap[a.asset] || '#000',
            })),
            assets: p.allocations.map((a: any) => assetNameMap[a.asset]).join(', '),
            chartColor: p.id === 'stable' ? '#3b82f6' : p.id === 'risk-neutral' ? '#eab308' : '#ef4444'
          }));
          
          setFetchedPortfolios(mappedPortfolios);
          setIsCompleted(true);
        } else {
          alert(`서버 오류: ${data.message || '저장 실패'}`);
        }
      } catch (e) {
        console.error("통신 에러", e);
        alert("서버 통신에 실패했습니다.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRestart = () => {
    setIsCompleted(false);
    setShowPortfolioSelection(false);
    setCurrentStep(0);
    setAnswers({});
    setSelectedOption(null);
    setSelectedPortfolio(null);
    localStorage.removeItem('surveyAnswers');
    localStorage.removeItem('selectedPortfolio');
  };

  const handlePortfolioSelect = (portfolio: Portfolio) => {
    setSelectedPortfolio(portfolio);
  };

  // 💡 선택 완료 시 대시보드로 이동만 처리
  const handleConfirm = () => {
    if (!selectedPortfolio) return;
    localStorage.setItem('selectedPortfolio', JSON.stringify(selectedPortfolio));
    localStorage.removeItem('surveyAnswers');
    navigate('/dashboard', { replace: true });
  };

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  // ── 포트폴리오 선택 화면 ──────────────────────────────────────────────────
  if (showPortfolioSelection) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-6xl">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 p-6 md:p-10">
            <div className="text-center mb-8">
              <span className="inline-block px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold tracking-widest uppercase mb-4">
                투자 성향 기반 자산 유형 분석 결과
              </span>
              <h1 className="text-2xl md:text-4xl font-black font-headline tracking-tight text-[#1A237E] dark:text-white mb-2">
                포트폴리오 선택
              </h1>
              <p className="text-sm md:text-base text-on-surface-variant font-bold tracking-widest uppercase">3가지 맞춤형 포트폴리오가 제공되었습니다.</p>
              <p className="text-sm md:text-base text-on-surface-variant font-bold tracking-widest uppercase">(선택후 대시보드에서 비율과 자산 종류 수정이 가능합니다.)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mb-8">
              {fetchedPortfolios.map((portfolio) => (
                <button
                  key={portfolio.id}
                  onClick={() => handlePortfolioSelect(portfolio)}
                  className={`group relative p-6 md:p-7 rounded-xl border-2 transition-all duration-300 text-left min-h-[380px] flex flex-col hover:scale-[1.03] hover:shadow-xl ${
                    selectedPortfolio?.id === portfolio.id
                      ? 'border-[#1A237E] bg-surface-container-low shadow-xl scale-[1.03]'
                      : 'border-outline-variant/30 bg-surface-container-low hover:border-[#1A237E]/40'
                  }`}
                >
                  <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                    selectedPortfolio?.id === portfolio.id
                      ? 'border-[#1A237E] bg-[#1A237E]'
                      : 'border-outline-variant group-hover:border-[#1A237E]'
                  }`}>
                    {selectedPortfolio?.id === portfolio.id && (
                      <span className="material-symbols-outlined text-white text-xs" style={{ fontVariationSettings: '"FILL" 1, "wght" 700' }}>check</span>
                    )}
                  </div>

                  <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-full mb-5 text-white font-bold text-sm shadow-sm" style={{ backgroundColor: portfolio.chartColor }}>
                    {portfolio.name}
                  </div>

                  <div className="flex items-center justify-center mb-6 flex-grow relative">
                    {selectedPortfolio?.id === portfolio.id && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl shadow-lg border border-outline-variant/20 px-4 py-3 space-y-1.5">
                          {portfolio.chartData.map((entry) => (
                            <div key={entry.name} className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs font-bold text-on-surface-variant w-16">{assetNameMap[entry.name]}</span>
                              <span className="text-xs font-black text-[#1A237E]">{entry.value}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className={`w-40 h-40 md:w-44 md:h-44 transition-transform duration-300 group-hover:scale-110 ${selectedPortfolio?.id === portfolio.id ? 'scale-110' : ''}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={portfolio.chartData} cx="50%" cy="50%" innerRadius="55%" outerRadius="90%" startAngle={90} endAngle={-270} dataKey="value">
                            {portfolio.chartData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [`${value}%`, assetNameMap[name as string] ?? name]}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-outline-variant/30 mt-auto">
                    <p className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">구성 금융 자산</p>
                    <p className="text-sm md:text-base text-[#1A237E] dark:text-indigo-200 font-bold leading-snug">{portfolio.assets}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowPortfolioSelection(false)}
                className="flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 border-2 border-[#1A237E] text-[#1A237E] hover:bg-[#1A237E] hover:text-white active:scale-95"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                뒤로
              </button>
              <button
                disabled={!selectedPortfolio}
                onClick={handleConfirm}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                  selectedPortfolio
                    ? 'bg-[#1A237E] text-white hover:bg-[#1A237E]/90 hover:shadow-lg active:scale-95'
                    : 'bg-surface-container-low text-on-surface-variant cursor-not-allowed'
                }`}
              >
                대시보드로 이동
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
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

              <div className="flex flex-col md:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleRestart}
                  className="w-full md:w-auto px-6 py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 border-2 border-[#1A237E] text-[#1A237E] hover:bg-[#1A237E] hover:text-white active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  다시 시작
                </button>
                <button
                  onClick={() => setShowPortfolioSelection(true)}
                  className="w-full md:w-auto px-6 py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 bg-[#1A237E] text-white hover:bg-[#1A237E]/90 hover:scale-105 hover:shadow-[0_0_20px_rgba(26,35,126,0.3)] hover:gap-3 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">bar_chart</span>
                  맞춤형 포트폴리오 만들기
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
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#1A237E] shadow-lg">
              <span className="material-symbols-outlined text-white text-4xl">assignment</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-2xl md:text-3xl font-black font-headline tracking-tight text-[#1A237E] dark:text-white leading-tight">
                저희 서비스에 처음 오셨군요!
              </h1>
              <p className="text-base md:text-lg text-on-surface-variant font-bold leading-relaxed">
                FINTOR는 사용자의 투자 유형에 따라<br className="hidden md:block" /> 자산을 구성해드립니다.<br />
                간단한 설문을 시작합니다.
              </p>
            </div>

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
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-700">
            <div className="h-full bg-[#1A237E] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>

          <div className="px-6 py-10 md:px-10 md:py-12">
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

            {isMultiStep && (
              <p className="text-sl font-bold text-on-surface-variant text-center mb-5">
                최대 3가지 선택 ({selectedOptions.length} / 3)
              </p>
            )}

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
                disabled={!canProceed || isSubmitting}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg font-bold text-sm md:text-base transition-all duration-200 flex items-center gap-1.5 active:scale-95 ${
                  canProceed && !isSubmitting
                    ? 'bg-[#1A237E] text-white hover:bg-[#1A237E]/90 hover:scale-105 hover:shadow-[0_0_20px_rgba(26,35,126,0.3)] hover:gap-2.5'
                    : 'bg-surface-container-low text-slate-300 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? '저장 중...' : (currentStep === questions.length - 1 ? '완료' : '다음')}
                {!isSubmitting && <span className="material-symbols-outlined text-base">arrow_forward</span>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}