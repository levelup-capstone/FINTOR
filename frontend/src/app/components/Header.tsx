import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router';

// ─── 시장지수 티커 (뉴스/퀴즈 탭 한정) ────────────────────────────────────
const TICKER_KEYS = ['SP500', 'NASDAQ100', 'KOSPI', 'KOSDAQ', 'BTC_KRW', 'USD_KRW', 'JPY_KRW'] as const;
const TICKER_LABEL: Record<string, string> = {
  SP500: 'S&P 500',
  NASDAQ100: 'NASDAQ 100',
  KOSPI: 'KOSPI',
  KOSDAQ: 'KOSDAQ',
  BTC_KRW: '비트코인',
  USD_KRW: 'USD/KRW',
  JPY_KRW: 'JPY/KRW',
};
type TickerItem = { price: number; change_rate: number; change_value: number; source: string };

function formatTickerPrice(key: string, price: number): string {
  if (key === 'BTC_KRW') return `${(price / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만`;
  if (key === 'USD_KRW' || key === 'JPY_KRW') {
    return price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MarketTicker() {
  const [data, setData] = useState<Record<string, TickerItem> | null>(null);

  useEffect(() => {
    const load = () => {
      fetch('/api/v1/market/indices')
        .then((r) => r.json())
        .then((json) => { if (json.success) setData(json.data); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!data) {
    return (
      <div className="border-t border-outline-variant/20 bg-slate-100/60 dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-6 h-9 flex items-center">
          <span className="text-xs text-on-surface-variant">시장 지수 로딩 중…</span>
        </div>
      </div>
    );
  }

  const items = TICKER_KEYS
    .map((key) => ({ key, item: data[key] }))
    .filter((x) => x.item != null);

  return (
    <div className="border-t border-outline-variant/20 bg-slate-100/60 dark:bg-slate-900/60">
      <div className="max-w-7xl mx-auto px-6 overflow-hidden">
        <div className="ticker-track flex whitespace-nowrap py-2">
          {[...items, ...items].map((x, i) => {
            const isUp = x.item.change_rate >= 0;
            return (
              <div key={`${x.key}-${i}`} className="flex items-center gap-2 px-6 text-sm shrink-0">
                <span className="font-bold text-on-surface">{TICKER_LABEL[x.key]}</span>
                <span className="tabular-nums text-on-surface-variant">{formatTickerPrice(x.key, x.item.price)}</span>
                <span className={`tabular-nums font-bold ${isUp ? 'text-error' : 'text-blue-700'}`}>
                  {isUp ? '▲' : '▼'} {Math.abs(x.item.change_rate).toFixed(2)}%
                </span>
                <span className="text-on-surface-variant/40">|</span>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes ticker-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: ticker-marquee 30s linear infinite;
          will-change: transform;
        }
        .ticker-track:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track { animation: none; }
        }
      `}</style>
    </div>
  );
}

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = [
    { label: '대시보드', to: '/dashboard' },
    { label: '시뮬레이터', to: '/dashboard/simulator' },
    { label: '퀴즈', to: '/dashboard/quiz' },
    { label: '뉴스', to: '/dashboard/news' },
  ];
  const activeClass = "text-[#1A237E] dark:text-white font-bold border-b-2 border-[#1A237E] py-1";
  const inactiveClass = "text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors px-3 py-1 rounded-lg";
  const dropdownRef = useRef<HTMLDivElement>(null);

  // localStorage에서 로그인 시 저장된 사용자 정보 읽기
  const loginData = (() => {
    try {
      return JSON.parse(localStorage.getItem('loginResult') || 'null')?.data;
    } catch {
      return null;
    }
  })();
  const nickname: string | null = loginData?.nickname ?? null;
  const profileImage: string | null = loginData?.profileImage ?? null;

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 로그아웃: 백엔드 호출 → localStorage 초기화 → 로그인 페이지 이동
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // 백엔드 오류여도 클라이언트 로그아웃은 진행
    } finally {
      localStorage.clear();
      navigate('/');
    }
  };

  return (
    <header className="docked full-width top-0 sticky z-50 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-md">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black text-[#1A237E] dark:text-white tracking-tighter font-headline">
            Fintor
          </span>
          <nav className="hidden md:flex gap-4">
            {navItems.map((item) => {
              const isActive =
                item.to === '/dashboard'
                  ? location.pathname === '/dashboard' || location.pathname === '/dashboard/'
                  : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={isActive ? activeClass : inactiveClass}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-slate-200/50 transition-colors relative">
            <span className="material-symbols-outlined text-on-surface-variant">
              notifications
            </span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
          </button>

          {/* 프로필 버튼 + 드롭다운 */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="p-0.5 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95 hover:ring-2 hover:ring-slate-300"
            >
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={nickname ?? '프로필'}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant">
                  account_circle
                </span>
              )}
            </button>

            {/* 드롭다운 메뉴 */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden z-50">
                {nickname && (
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{nickname}</p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <MarketTicker />
    </header>
  );
}
