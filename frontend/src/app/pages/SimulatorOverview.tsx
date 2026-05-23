import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchParticipation, fetchMyParticipation, fetchScenarios, fetchGameScore, startGame, type ParticipationData, type ScenarioInfo, type GameScore } from './simulatorApi';

const TOTAL_DAYS = 7;

export function SimulatorOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<ParticipationData | null>(null);
  const [firstScenario, setFirstScenario] = useState<ScenarioInfo | null>(null);
  const [scoreData, setScoreData] = useState<GameScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const loadParticipation = async (id: number) => {
      const d = await fetchParticipation(id);
      if (d) {
        setData(d);
        if (d.is_finalized) {
          const score = await fetchGameScore(id);
          setScoreData(score);
        }
      } else {
        localStorage.removeItem('participationId');
      }
    };

    const pid = localStorage.getItem('participationId');
    const tasks: Promise<unknown>[] = [
      fetchScenarios().then((s) => { if (s.length > 0) setFirstScenario(s[0]); }),
    ];
    if (pid) {
      tasks.push(loadParticipation(Number(pid)));
    } else {
      tasks.push(
        fetchMyParticipation().then((r) => {
          if (r) {
            localStorage.setItem('participationId', String(r.participation_id));
            return loadParticipation(r.participation_id);
          }
        })
      );
    }
    Promise.all(tasks).finally(() => setLoading(false));
  }, []);

  const handleStart = async () => {
    if (!firstScenario || starting) return;
    // 백엔드는 idempotent: 진행 중 게임이 있으면 기존 ID 반환, 없으면 신규 생성.
    // localStorage의 stale pid는 무시하고 항상 API 호출.
    setStarting(true);
    try {
      const result = await startGame(firstScenario.id);
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

  const scenario = data?.scenario ?? firstScenario;

  if (!scenario) {
    return (
      <div className="flex flex-col gap-6">
        <div className="w-full bg-surface-container-lowest rounded-2xl p-8 text-center border border-outline-variant/30">
          <p className="text-on-surface-variant font-semibold">사용 가능한 시즌이 없습니다.</p>
        </div>
      </div>
    );
  }

  const isParticipating = !!data;
  const isFinalized = !!data?.is_finalized;
  const today_index = data?.today_index ?? 0;
  const current_value = data?.current_value ?? 0;
  const total_return = data?.total_return ?? 0;
  const progressPct = isParticipating ? Math.round((today_index / TOTAL_DAYS) * 100) : 0;
  const isUp = total_return >= 0;

  const totalScore = scoreData?.total_score ?? null;
  const rank = scoreData?.rank ?? null;

  const onCardClick = () => {
    if (!isParticipating) {
      handleStart();
    } else if (isFinalized) {
      navigate('/dashboard/simulator/season/result');
    } else {
      navigate('/dashboard/simulator/season');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={onCardClick}
        disabled={starting}
        aria-label={
          isFinalized
            ? `시즌 #${scenario.stage} ${scenario.theme} 결과 보기`
            : isParticipating
            ? `시즌 #${scenario.stage} ${scenario.theme} 상세 보기`
            : `시즌 #${scenario.stage} ${scenario.theme} 참여하기`
        }
        className="w-full text-left bg-[#1A237E] text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.005] hover:bg-[#1f2a8c] active:scale-[0.998] disabled:opacity-70 disabled:cursor-not-allowed"
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
          {isFinalized ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 bg-emerald-400/90 text-[#0a1645] text-sm font-black px-3 py-1 rounded-md tracking-widest">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                CLEAR
              </span>
              <span className="text-xs text-white/70 font-semibold">시즌 종료 · 결과 확인</span>
            </div>
          ) : isParticipating ? (
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
          ) : (
            <p className="text-sm text-white/70 mt-1">7일 동안 진행되는 가상 투자 시뮬레이션</p>
          )}
        </div>

        {/* 우측: 참여 전엔 CTA, 진행 중엔 자산, 종료엔 점수/랭킹 */}
        <div className="flex gap-6 sm:gap-8 z-10 w-full md:w-auto bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
          {isFinalized ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">최종 점수</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl md:text-4xl font-black tracking-tight">{totalScore != null ? Math.round(totalScore) : '-'}</span>
                  <span className="text-sm font-semibold text-white/60">/ 100</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">랭킹</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl md:text-4xl font-black tracking-tight">{rank ?? '-'}</span>
                  <span className="text-sm font-semibold text-white/60">위</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-white/70 self-center hidden md:block">chevron_right</span>
            </>
          ) : isParticipating ? (
            <>
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
            </>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <span className="material-symbols-outlined text-3xl text-white">play_circle</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">최초 1회</span>
                <span className="text-lg md:text-xl font-black tracking-tight">
                  {starting ? '참여 중...' : '시즌 참여하기'}
                </span>
              </div>
              <span className="material-symbols-outlined text-white/70 self-center ml-auto">chevron_right</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
