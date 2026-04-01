import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

const questions = [
  { id: 'age', title: '연령대를 선택해주세요', options: ['20대', '30대', '40대', '50대', '60대 이상'] },
  { id: 'experience', title: '투자 경력은 얼마나 되시나요?', options: ['없음', '1년 미만', '1-3년', '3-5년', '5년 이상'] },
  { id: 'period', title: '선호하는 투자 기간은?', options: ['단기 (1년 미만)', '중기 (1-3년)', '장기 (3년 이상)'] },
  { id: 'assetType', title: '선호하는 자산 종류는?', options: ['주식', '채권', '펀드', '부동산', '원화', '금'] },
  { id: 'risk', title: '감수 가능한 리스크 정도는?', options: ['매우 낮음', '낮음', '보통', '높음', '매우 높음'] },
  { id: 'investAmount', title: '투자 가능한 자산 규모는?', options: ['1천만원 미만', '1천만원-5천만원', '5천만원-1억', '1억-3억', '3억 이상'] },
  { id: 'income', title: '월 소득 수준은?', options: ['200만원 미만', '200-400만원', '400-600만원', '600-800만원', '800만원 이상'] },
  { id: 'goal', title: '투자 목적은 무엇인가요?', options: ['노후 준비', '자산 증식', '자녀 교육', '주택 마련', '여유 자금 운용'] },
];

export function Survey() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('surveyAnswers');
    if (saved) setAnswers(JSON.parse(saved));
  }, []);

  useEffect(() => {
    setSelectedOption(answers[questions[currentStep].id] || null);
  }, [currentStep, answers]);

  const handleOptionClick = (option: string) => setSelectedOption(option);

  const handleNext = async () => {
    if (!selectedOption) return;

    const newAnswers = { ...answers, [questions[currentStep].id]: selectedOption };
    setAnswers(newAnswers);
    localStorage.setItem('surveyAnswers', JSON.stringify(newAnswers));

    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // 설문 완료 → 백엔드 전송
      try {
        const token = localStorage.getItem('accessToken');
        await fetch('http://localhost:8000/api/survey', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(newAnswers),
        });
      } catch (e) {
        // 백엔드 오류여도 대시보드로 이동
      }
      localStorage.removeItem('surveyAnswers');
      navigate('/dashboard', { replace: true });
    }
  };

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center py-8 px-4 relative overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30" />

      <div className="w-full max-w-3xl relative z-10">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden border border-purple-100/50">
          {/* 진행 바 */}
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#1A237E] via-[#7C4DFF] to-[#D500F9] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="px-6 py-12 md:px-12 md:py-16">
            {/* 진행 상태 */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-100 via-blue-100 to-indigo-100 rounded-full mb-6 shadow-sm">
                <svg className="w-2 h-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-bold text-purple-700">질문 {currentStep + 1} / {questions.length}</p>
              </div>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-[#1A237E] via-[#7C4DFF] to-[#D500F9] bg-clip-text text-transparent mb-3 leading-tight">
                {currentQuestion.title}
              </h1>
              <div className="flex items-center justify-center gap-2 mt-4">
                {questions.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentStep
                        ? 'w-8 bg-gradient-to-r from-[#7C4DFF] to-[#D500F9]'
                        : index < currentStep
                        ? 'w-2 bg-[#1A237E]'
                        : 'w-2 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 옵션 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionClick(option)}
                  className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                    selectedOption === option
                      ? 'border-[#7C4DFF] bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 shadow-xl scale-105'
                      : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-lg'
                  }`}
                >
                  <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    selectedOption === option
                      ? 'bg-gradient-to-r from-[#7C4DFF] to-[#D500F9] text-white shadow-lg'
                      : 'bg-gray-100 text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-lg font-bold transition-colors ${
                      selectedOption === option ? 'text-[#1A237E]' : 'text-gray-700 group-hover:text-[#1A237E]'
                    }`}>
                      {option}
                    </span>
                    <div className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                      selectedOption === option
                        ? 'border-[#7C4DFF] bg-gradient-to-r from-[#7C4DFF] to-[#D500F9] shadow-lg'
                        : 'border-gray-300 group-hover:border-[#7C4DFF]'
                    }`}>
                      {selectedOption === option && (
                        <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {selectedOption === option && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400/5 via-blue-400/5 to-indigo-400/5 rounded-2xl animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            {/* 이전 / 다음 버튼 */}
            <div className="flex items-center justify-between mt-12">
              {currentStep > 0 ? (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-8 py-4 text-gray-600 hover:text-[#7C4DFF] font-bold transition-all duration-300 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                  이전
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={handleNext}
                disabled={!selectedOption}
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-2 ${
                  selectedOption
                    ? 'text-[#1A237E] hover:text-[#7C4DFF]'
                    : 'text-gray-300 cursor-not-allowed opacity-50'
                }`}
              >
                {currentStep === questions.length - 1 ? '완료' : '다음'}
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
