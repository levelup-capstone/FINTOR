export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-64 space-y-6">
      <div className="bg-surface-container-lowest p-6 rounded-xl space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden">
            <img 
              alt="사용자 프로필" 
              className="w-full h-full object-cover" 
              src="https://images.unsplash.com/photo-1662109987933-44bf8a6e6871?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbG9zZSUyMHVwJTIwcHJvZmlsZSUyMG9mJTIwYSUyMHByb2Zlc3Npb25hbCUyMGluJTIwYSUyMG1pbmltYWxpc3QlMjBzZXR0aW5nJTIwY2xlYW4lMjBsaW5lcyUyMGJyaWdodCUyMGFpcnklMjBmZWVsfGVufDF8fHx8MTc3NDU3OTU1Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
            />
          </div>
          <div>
            <p className="font-bold text-primary text-sm">고결한 투자자</p>
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
