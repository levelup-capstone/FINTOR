import { useNavigate } from 'react-router';

export function SimulatorOverview() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => navigate('/dashboard/simulator/season')}
        aria-label="시즌 #1 고금리 장기화 상세 보기"
        className="w-full text-left bg-[#1A237E] text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.005] hover:bg-[#1f2a8c] active:scale-[0.998]"
      >
        {/* 배경 장식 */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent_60%)] pointer-events-none" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-400 rounded-full opacity-20 blur-3xl pointer-events-none" />

        {/* 좌측: 시즌 정보 */}
        <div className="flex flex-col gap-2 z-10">
          <div className="flex items-center gap-3">
            <span className="bg-white/20 px-2 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
              SEASON #1
            </span>
            <h3 className="text-2xl md:text-3xl font-black tracking-tight">고금리 장기화</h3>
          </div>
          <div className="flex items-end gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white/70">Day</span>
              <span className="text-lg font-bold">
                3 <span className="text-white/50 text-sm font-normal">/ 7</span>
              </span>
            </div>
            <div className="w-32 md:w-48 h-2 bg-white/20 rounded-full overflow-hidden mb-1">
              <div className="bg-white h-full rounded-full" style={{ width: '42%' }} />
            </div>
          </div>
        </div>

        {/* 우측: 자산 + 순위 */}
        <div className="flex gap-6 sm:gap-8 z-10 w-full md:w-auto bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/70">총 자산 (Equity)</span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl md:text-3xl font-black tracking-tight">₩10,234,000</span>
              <span className="text-sm font-semibold text-emerald-300 flex items-center">
                <span className="material-symbols-outlined text-[16px] mr-0.5">trending_up</span>
                +2.3%
              </span>
            </div>
          </div>
          <div className="hidden sm:flex flex-col gap-1 border-l border-white/20 pl-6 sm:pl-8">
            <span className="text-xs font-semibold text-white/70">현재 순위</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-3xl font-black tracking-tight">47</span>
              <span className="text-sm font-medium text-white/70">th</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-white/70 self-center hidden md:block">chevron_right</span>
        </div>
      </button>
    </div>
  );
}
