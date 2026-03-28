export function Sidebar() {
  // localStorage에서 로그인 시 저장된 사용자 정보 읽기
  const loginData = (() => {
    try {
      return JSON.parse(localStorage.getItem('loginResult') || 'null')?.data;
    } catch {
      return null;
    }
  })();
  const nickname: string = loginData?.nickname ?? '사용자';
  const profileImage: string | null = loginData?.profileImage ?? null;

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
            <p className="text-xs text-on-surface-variant">Premium Member</p>
          </div>
        </div>
        <button className="w-full py-2 px-4 bg-primary text-white rounded-lg text-xs font-semibold hover:translate-x-1 transition-transform">
          자산 리포트 보기
        </button>
      </div>
      <nav className="space-y-2">
        <a className="flex items-center gap-3 p-3 bg-primary text-white rounded-lg shadow-lg shadow-[#1A237E]/20 transition-transform" href="#">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="font-semibold text-sm">대시보드</span>
        </a>
        <a className="flex items-center gap-3 p-3 text-slate-600 hover:bg-slate-200 rounded-lg transition-transform hover:translate-x-1" href="#">
          <span className="material-symbols-outlined">edit_note</span>
          <span className="font-semibold text-sm">기록</span>
        </a>
        <a className="flex items-center gap-3 p-3 text-slate-600 hover:bg-slate-200 rounded-lg transition-transform hover:translate-x-1" href="#">
          <span className="material-symbols-outlined">quiz</span>
          <span className="font-semibold text-sm">퀴즈</span>
        </a>
        <a className="flex items-center gap-3 p-3 text-slate-600 hover:bg-slate-200 rounded-lg transition-transform hover:translate-x-1" href="#">
          <span className="material-symbols-outlined">newspaper</span>
          <span className="font-semibold text-sm">뉴스</span>
        </a>
        <a className="flex items-center gap-3 p-3 text-slate-600 hover:bg-slate-200 rounded-lg transition-transform hover:translate-x-1" href="#">
          <span className="material-symbols-outlined">settings</span>
          <span className="font-semibold text-sm">설정</span>
        </a>
      </nav>
    </aside>
  );
}
