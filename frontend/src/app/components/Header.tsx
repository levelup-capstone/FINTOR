export function Header() {
  return (
    <header className="docked full-width top-0 sticky z-50 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-md">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black text-[#1A237E] dark:text-white tracking-tighter font-headline">
            FINTO
          </span>
          <nav className="hidden md:flex gap-4">
            <a
              className="text-[#1A237E] dark:text-white font-bold border-b-2 border-[#1A237E] py-1"
              href="#"
            >
              대시보드
            </a>
            <a
              className="text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors px-3 py-1 rounded-lg"
              href="#"
            >
              기록
            </a>
            <a
              className="text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors px-3 py-1 rounded-lg"
              href="#"
            >
              퀴즈
            </a>
            <a
              className="text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors px-3 py-1 rounded-lg"
              href="#"
            >
              뉴스
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-slate-200/50 transition-colors relative">
            <span className="material-symbols-outlined text-on-surface-variant">
              notifications
            </span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
          </button>
          <button className="p-2 rounded-full transition-all duration-200 hover:bg-slate-200 hover:scale-110 hover:shadow-md active:scale-95">
            <span className="material-symbols-outlined text-on-surface-variant">
              account_circle
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}