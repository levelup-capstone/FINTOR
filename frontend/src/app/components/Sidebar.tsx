import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';

function readLoginData() {
  try {
    return JSON.parse(localStorage.getItem('loginResult') || 'null')?.data ?? null;
  } catch {
    return null;
  }
}

export function Sidebar() {
  const location = useLocation();
  const [nickname, setNickname] = useState<string>(() => readLoginData()?.nickname ?? '사용자');
  const [profileImage] = useState<string | null>(() => readLoginData()?.profileImage ?? null);
  const [riskType, setRiskType] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { nickname: next } = (e as CustomEvent<{ nickname: string }>).detail;
      setNickname(next);
    };
    window.addEventListener('nickname-changed', handler);
    return () => window.removeEventListener('nickname-changed', handler);
  }, []);

  useEffect(() => {
    const userId = readLoginData()?.userId;
    if (!userId) return;
    fetch(`/api/v1/users/${userId}/level`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setRiskType(json.data.riskType ?? null); })
      .catch(() => {});
  }, []);

  const menuItems = [
    { label: '대시보드', to: '/dashboard', icon: 'dashboard' },
    { label: '시뮬레이터', to: '/dashboard/simulator', icon: 'play_circle' },
    { label: '퀴즈', to: '/dashboard/quiz', icon: 'quiz' },
    { label: '뉴스', to: '/dashboard/news', icon: 'newspaper' },
    { label: '설정', to: '/dashboard/settings', icon: 'settings' },
  ];
  const activeClass = 'flex items-center gap-3 p-3 bg-primary text-white rounded-lg shadow-lg shadow-[#1A237E]/20 transition-transform';
  const inactiveClass = 'flex items-center gap-3 p-3 text-slate-600 hover:bg-slate-200 rounded-lg transition-transform hover:translate-x-1';

  return (
    <aside className="hidden lg:flex flex-col w-64 space-y-6">
      <div className="bg-surface-container-lowest p-6 rounded-xl space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          {/* 프로필 이미지: 카카오 사진 있으면 표시, 없으면 기본 아이콘 */}
          <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-slate-100">
            {profileImage ? (
              <img
                src={profileImage}
                alt={nickname}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-slate-400 text-4xl">account_circle</span>
            )}
          </div>
          <div>
            <p className="font-bold text-primary text-sm">{nickname}</p>
          </div>
        </div>
        <button className="w-full py-2 px-4 bg-primary text-white rounded-lg text-xs font-semibold hover:translate-x-1 transition-transform">
          자산 리포트 보기
        </button>
      </div>
      <nav className="space-y-2">
        {menuItems.map((item) => {
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
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-semibold text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
