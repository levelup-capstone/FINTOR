import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchParticipation, fetchScenarios, startGame, type ParticipationData } from './simulatorApi';

const TOTAL_DAYS = 7;

export function SimulatorOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<ParticipationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const pid = localStorage.getItem('participationId');
    if (!pid) { setLoading(false); return; }
    fetchParticipation(Number(pid)).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const handleStart = async () => {
    setStarting(true);
    try {
      const scenarios = await fetchScenarios();
      if (!scenarios.length) return;
      const result = await startGame(scenarios[0].id);
      if (result) {
        localStorage.setItem('participationId', String(result.participation_id));
        navigate('/dashboard/simulator/season');
      }
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="w-full bg-[#1A237E]/20 rounded-2xl p-6 h-36 animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="w-full bg-surface-container-lowest rounded-2xl p-8 text-center border border-outline-variant/30">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3 block">sports_esports</span>
          <p className="text-on-surface-variant font-semibold mb-4">진행 중인 시뮬레이션이 없습니다.</p>
          <button
            onClick={handleStart}
            disabled={starting}
            className="px-6 py-2.5 rounded-xl bg-[#1A237E] text-white font-bold text-sm hover:bg-[#1A237E]/90 transition-colors disabled:opacity-60"
          >
            {starting ? '시작 중...' : '시뮬레이션 시작하기'}
          </button>
        </div>
      </div>
    );
  }

  const { scenario, today_index, current_value, total_return } = data;
  const progressPct = Math.round((today_index / TOTAL_DAYS) * 100);
  const isUp = total_return >= 0;

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => navigate('/dashboard/simulator/season')}
        aria-label={`시즌 #${scenario.stage} ${scenario.theme} 상세 보기`}
        className="w-full text-left bg-[#1A237E] text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.005] hover:bg-[#1f2a8c] active:scale-[0.998]"
      >
        {/* 배경 장식 */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent_60%)] pointer-events-none" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-400 rounded-full opacity-20 blur-3xl pointer-events-none" />

        {/* 좌측: 시즌 정보 */}
        <div className="flex flex-col gap-2 z-10">
          <div className="flex items-center gap-3">
            <span className="bg-white/20 px-2 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
              SEASON #{scenario.stage}
            </span>
            <h3 className="text-2xl md:text-3xl font-black tracking-tight">{scenario.theme}</h3>
          </div>
          <div className="flex items-end gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white/70">Day</span>
              <span className="text-lg font-bold">
                {today_index} <span className="text-white/50 text-sm font-normal">/ {TOTAL_DAYS}</span>
              </span>
            </div>
            <div className="w-32 md:w-48 h-2 bg-white/20 rounded-full overflow-hidden mb-1">
              <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        {/* 우측: 자산 + 수익률 */}
        <div className="flex gap-6 sm:gap-8 z-10 w-full md:w-auto bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/70">총 자산 (Equity)</span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl md:text-3xl font-black tracking-tight">
                ₩{Math.floor(current_value).toLocaleString()}
              </span>
              <span className={`text-sm font-semibold flex items-center ${isUp ? 'text-emerald-300' : 'text-red-300'}`}>
                <span className="material-symbols-outlined text-[16px] mr-0.5">
                  {isUp ? 'trending_up' : 'trending_down'}
                </span>
                {isUp ? '+' : ''}{total_return.toFixed(2)}%
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-white/70 self-center hidden md:block">chevron_right</span>
        </div>
      </button>
    </div>
  );
}
