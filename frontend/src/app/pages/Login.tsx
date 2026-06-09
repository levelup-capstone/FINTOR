import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import kakaoLoginButton from "../../assets/kakao_login_button.png";
import { PolicyModal } from "../components/PolicyModal";
import backgroundVideo from "../../assets/backgroundVideo.mp4";

export function Login() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [oauthError, setOauthError] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);

  // 이미 로그인된 상태면 대시보드로 바로 이동
  useEffect(() => {
    const savedLoginData = localStorage.getItem("loginResult");
    if (savedLoginData) {
      try {
        JSON.parse(savedLoginData);
        navigate("/dashboard", { replace: true });
      } catch {
        localStorage.removeItem("loginResult");
      }
    }
  }, []);

  // 카카오 로그인 시작
  const handleKakaoLogin = () => {
    const restApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/oauth/kakao`,
    );
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${restApiKey}&redirect_uri=${redirectUri}&response_type=code&prompt=login`;
    window.location.href = kakaoAuthUrl;
  };

  /** 랜딩 페이지 내 섹션으로 부드럽게 스크롤 */
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/15 backdrop-blur-md border-b border-black/5 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between">
            {/* 로고 */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/*<div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">F</span>
              </div>*/}
              <span className="text-2xl font-black text-[#ffffff] dark:text-white tracking-tighter font-headline">
                Fintor
              </span>
            </div>

            {/* 데스크톱 메뉴 */}
            <nav className="hidden md:flex items-center gap-8 text-xs">
              <button
                type="button"
                onClick={() => scrollToSection("features")}
                className="text-white/90 hover:text-white transition-colors"
              >
                서비스 소개
              </button>
              <button
                type="button"
                onClick={handleKakaoLogin}
                className="bg-white text-[#2B3674] px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors text-sm font-semibold"
              >
                무료로 시작하기
              </button>
            </nav>

            {/* 모바일 메뉴 버튼 */}
            <button
              type="button"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Menu className="w-6 h-6 text-white" />
              )}
            </button>
          </div>

          {/* 모바일 메뉴 */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 flex flex-col gap-4 text-xs">
              <button
                type="button"
                onClick={() => scrollToSection("features")}
                className="text-left text-white/90 hover:text-white transition-colors"
              >
                서비스 소개
              </button>
              <button
                type="button"
                onClick={handleKakaoLogin}
                className="bg-white text-[#1A237E] px-8 py-2.5 rounded-lg hover:bg-white/90 transition-colors text-left font-semibold"
              >
                무료로 시작하기
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* 메인 히어로 섹션 */}
      <div id="hero" className="relative h-screen bg-[#323278] overflow-hidden">
        {/* 배경 영상 */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={backgroundVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/35"></div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-full opacity-20">
          <div className="absolute right-10 top-1/2 -translate-y-1/2 w-96 h-96">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-white/30 to-transparent backdrop-blur-3xl"></div>
          </div>
        </div>
        <div className="absolute left-0 top-1/4 w-1/3 h-1/3 opacity-15">
          <div className="absolute left-10 top-0 w-72 h-72">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-white/20 to-transparent backdrop-blur-3xl"></div>
          </div>
        </div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 opacity-10">
          <div className="w-full h-full rounded-full bg-gradient-to-tl from-blue-300/40 to-transparent blur-3xl"></div>
        </div>

        <div className="relative z-10 h-screen flex flex-col items-center justify-center px-4 sm:px-8 md:px-16 lg:px-24">
          <div className="max-w-4xl w-full text-center">
            {oauthError && (
              <p
                role="alert"
                className="mb-6 max-w-xl mx-auto rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100"
              >
                {oauthError}
              </p>
            )}
            <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-bold text-white mb-4 sm:mb-6 md:mb-8 leading-tight tracking-tight">
              Fintor
            </h1>
            <p className="text-white/90 text-base sm:text-lg md:text-2xl mb-8 sm:mb-10 md:mb-14 leading-relaxed font-medium px-2">
              매일 풀고 레벨업하는
              <br className="sm:hidden" /> 투자 학습 플랫폼
            </p>
            <p className="text-white/80 text-sm sm:text-base md:text-lg mb-8 sm:mb-10 leading-relaxed max-w-2xl mx-auto px-2">
              퀴즈, 시뮬레이션, 실시간 뉴스로 즐겁게 투자를 배우세요.
              <br />
              가상 자금으로 안전하게 자산 배분을 경험합니다.
            </p>

            {/* 카카오 로그인 버튼 */}
            <div className="flex justify-center gap-4 mb-8">
              <button
                type="button"
                onClick={handleKakaoLogin}
                className="transition-transform hover:scale-105 active:scale-95"
              >
                <img
                  src={kakaoLoginButton}
                  alt="카카오 로그인"
                  className="h-12 sm:h-14"
                />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => scrollToSection("features")}
            className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
            aria-label="아래로 스크롤"
          >
            <ChevronDown className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </button>
        </div>
      </div>

      {/* 서비스 설명 섹션 */}
      <div
        id="features"
        className="bg-white px-4 sm:px-8 md:px-16 lg:px-24 py-16 sm:py-20 md:py-28"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
              Fintor가 제공하는 핵심 기능
            </h2>
            <p className="text-gray-600 text-base sm:text-lg px-2">
              게이미피케이션으로 즐겁게 배우는 투자
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                emoji: "📅",
                color: "orange",
                title: "일일 퀴즈 챌린지",
                desc: "매일 6문제를 풀며 streak을 쌓아요",
                sub: "정답률에 따라 EXP와 레벨업 보상",
              },
              {
                emoji: "🎮",
                color: "blue",
                title: "가상 시즌 시뮬레이션",
                desc: "고금리·침체·블랙스완 등 7일 시나리오",
                sub: "실제 자금 없이 자산 배분 연습",
              },
              {
                emoji: "📰",
                color: "purple",
                title: "AI 시장 뉴스",
                desc: "호재·악재가 자동 분석된 실시간 뉴스",
                sub: "한눈에 확인하는 시장 흐름",
              },
              {
                emoji: "🎯",
                color: "green",
                title: "투자 성향 진단",
                desc: "9개 문항으로 5단계 성향 분석",
                sub: "안정형부터 공격투자형까지",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-all group"
              >
                <div
                  className={`w-12 h-12 bg-gradient-to-br from-${card.color}-100 to-${card.color}-50 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform`}
                >
                  <span className="text-2xl">{card.emoji}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-gray-900">
                  {card.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-3 sm:mb-4">
                  {card.desc}
                </p>
                <p className="text-xs text-gray-400">{card.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 사용 방법 섹션 */}
      <div
        id="about"
        className="bg-gradient-to-b from-white to-gray-50 px-4 sm:px-8 md:px-16 lg:px-24 py-16 sm:py-20 md:py-28"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
              Fintor 시작하기
            </h2>
            <p className="text-gray-600 text-base sm:text-lg px-2">
              3단계로 시작하는 투자 학습 여정
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: "1",
                title: "카카오 간편 가입",
                desc: "카카오 로그인으로 3초 만에 시작하세요. 복잡한 가입 절차 없이 바로 출발할 수 있습니다.",
              },
              {
                step: "2",
                title: "투자 성향 설문",
                desc: "9개 문항으로 본인의 투자 성향을 파악합니다. 안정형부터 공격투자형까지 5단계로 진단해요.",
              },
              {
                step: "3",
                title: "매일 학습 · 시뮬레이션",
                desc: "일일 퀴즈와 시즌 시나리오로 경험치를 쌓고 레벨을 올리며 투자 감각을 키워보세요.",
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#323278] to-[#4A5199] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <span className="text-2xl sm:text-3xl font-bold text-white">
                    {s.step}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                  {s.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed px-2">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 왜 FINTO 섹션 */}
      <div className="bg-gradient-to-b from-gray-50 to-white px-4 sm:px-8 md:px-16 lg:px-24 py-16 sm:py-20 md:py-28">
        <div className="max-w-6xl mx-auto w-full">
          <div className="bg-gradient-to-br from-[#323278] to-[#4A5199] p-8 sm:p-12 md:p-16 lg:p-20 rounded-2xl sm:rounded-3xl">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-white">
                왜 Fintor를 선택해야 할까요?
              </h2>
              <p className="text-white/90 text-sm sm:text-base md:text-lg leading-relaxed mb-8 sm:mb-10 md:mb-12 px-2">
                Fintor는 단순한 금융 콘텐츠 사이트가 아닙니다. 게임처럼 매일
                퀴즈를 풀고, 가상 자금으로 시즌 시나리오를 경험하며, 실제 자금
                위험 없이 투자 감각을 키울 수 있는 학습 플랫폼입니다.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 md:gap-8 text-left">
                {[
                  {
                    label: "매일의 습관",
                    desc: "퀴즈와 streak으로 학습 동기 부여",
                  },
                  {
                    label: "안전한 연습",
                    desc: "가상 자금으로 시즌 시뮬레이션",
                  },
                  {
                    label: "AI 뉴스 분석",
                    desc: "호재·악재 자동 분석된 시장 뉴스",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white/10 backdrop-blur-sm p-6 sm:p-8 md:p-10 rounded-xl hover:bg-white/20 hover:scale-105 transition-all duration-300 cursor-pointer"
                  >
                    <div className="text-3xl sm:text-4xl font-bold text-white mb-2 sm:mb-3">
                      {item.label}
                    </div>
                    <p className="text-white/80 text-sm sm:text-base md:text-lg">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        id="about"
        className="bg-gradient-to-b from-white to-gray-50 px-4 sm:px-8 md:px-16 lg:px-24 py-16 sm:py-20 md:py-10"
      >
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
            지금 바로 투자 학습에 참여하세요!
          </h2>

          <button
            type="button"
            onClick={handleKakaoLogin}
            className="transition-transform hover:scale-105 active:scale-95"
            aria-label="카카오로 시작하기"
          >
            <img
              src={kakaoLoginButton}
              alt="카카오 로그인"
              className="h-12 sm:h-14"
            />
          </button>
        </div>
      </div>
      {/* 최종 CTA */}
      <div className="mt-10 sm:mt-14 md:mt-16 flex flex-col items-center gap-3">
        <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2"></p>
      </div>

      {/* Footer */}
      <footer
        id="contact"
        className="bg-gradient-to-b from-gray-50 to-gray-100 px-4 sm:px-8 md:px-16 lg:px-24 py-12 sm:py-16"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div className="col-span-2 md:col-span-1">
              <h3 className="text-xl sm:text-2xl font-bold text-[#323278] mb-3 sm:mb-4">
                Fintor
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                매일 풀고 레벨업하는 투자 학습 플랫폼
              </p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">
                서비스
              </h4>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                <li>일일 퀴즈 챌린지</li>
                <li>가상 시즌 시뮬레이션</li>
                <li>AI 시장 뉴스</li>
                <li>투자 성향 진단</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">
                법적 고지
              </h4>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                <li>
                  <button
                    type="button"
                    onClick={() => setPolicyOpen(true)}
                    className="hover:text-[#1A237E] hover:underline transition-colors text-left"
                  >
                    이용약관
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setPolicyOpen(true)}
                    className="hover:text-[#1A237E] hover:underline transition-colors text-left"
                  >
                    개인정보처리방침
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-300 pt-6 sm:pt-8 text-center text-xs sm:text-sm text-gray-600">
            <p>© 2026 Fintor. All rights reserved.</p>
            <p className="mt-2">
              투자 권유가 아니며, 투자의 최종 책임은 투자자 본인에게 있습니다.
            </p>
          </div>
        </div>
      </footer>

      <PolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}
