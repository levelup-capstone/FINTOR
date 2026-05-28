import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  fetchParticipation, fetchMyParticipation, fetchScenarios, fetchGameScore, fetchMyClearedScenarios, startGame,
  type ParticipationData, type ScenarioInfo, type GameScore, type ClearedScenario,
} from './simulatorApi';

const TOTAL_DAYS = 7;

/** KST 자정 기준으로 from 시각의 "다음 날 00:00 KST"를 반환 */
function nextKstMidnight(from: Date): Date {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(from.getTime() + kstOffsetMs);
  const kstNextDay = new Date(Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return new Date(kstNextDay.getTime() - kstOffsetMs);
}

type ScenarioStatus = 'cleared' | 'active' | 'finalized' | 'available' | 'locked';
type ScenarioState = {
  scenario: ScenarioInfo;
  status: ScenarioStatus;
  unlockAt?: Date;
  cleared?: ClearedScenario;   // cleared/finalized 시즌의 점수·랭킹
};

/**
 * 각 시즌의 잠금/진행/완료 상태 계산.
 * - finalized: 활성 participation이면서 is_finalized=true (현재 보이는 시즌)
 * - active: 활성 participation이면서 진행 중
 * - cleared: 본인이 이미 클리어 (활성 시즌은 아님)
 * - available: 시작 가능
 * - locked: 이전 시즌 미클리어 또는 KST 자정 대기
 */
function determineStates(
  scenarios: ScenarioInfo[],
  activeData: ParticipationData | null,
  cleared: ClearedScenario[],
): ScenarioState[] {
  const sorted = [...scenarios].sort((a, b) => a.stage - b.stage);
  const now = Date.now();
  const clearedMap = new Map(cleared.map((c) => [c.scenario_id, c]));
  const activeId = activeData?.scenario.id ?? null;

  return sorted.map((scenario): ScenarioState => {
    if (activeId === scenario.id) {
      return {
        scenario,
        status: activeData?.is_finalized ? 'finalized' : 'active',
        cleared: clearedMap.get(scenario.id),
      };
    }
    if (clearedMap.has(scenario.id)) {
      return { scenario, status: 'cleared', cleared: clearedMap.get(scenario.id) };
    }
    if (scenario.stage === 1) return { scenario, status: 'available' };

    const prev = sorted.find((s) => s.stage === scenario.stage - 1);
    if (!prev) return { scenario, status: 'locked' };
    const prevCleared = clearedMap.get(prev.id);
    if (!prevCleared || !prevCleared.finalized_at) return { scenario, status: 'locked' };

    const unlockAt = nextKstMidnight(new Date(prevCleared.finalized_at));
    if (now >= unlockAt.getTime()) return { scenario, status: 'available' };
    return { scenario, status: 'locked', unlockAt };
  });
}

export function SimulatorOverview() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [activeData, setActiveData] = useState<ParticipationData | null>(null);
  const [scoreData, setScoreData] = useState<GameScore | null>(null);
  const [cleared, setCleared] = useState<ClearedScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const loadParticipation = async (id: number) => {
      const d = await fetchParticipation(id);
      if (d) {
        setActiveData(d);
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
      fetchScenarios().then((s) => setScenarios(s)),
      fetchMyClearedScenarios().then((c) => setCleared(c)),
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
        }),
      );
    }
    Promise.all(tasks).finally(() => setLoading(false));
  }, []);

  const states = useMemo(
    () => determineStates(scenarios, activeData, cleared),
    [scenarios, activeData, cleared],
  );

  const handleStart = async (scenarioId: number) => {
    if (starting) return;
    setStarting(true);
    try {
      const result = await startGame(scenarioId);
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

  if (states.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="w-full bg-surface-container-lowest rounded-2xl p-8 text-center border border-outline-variant/30">
          <p className="text-on-surface-variant font-semibold">사용 가능한 시즌이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-tour="simulator-overview" className="flex flex-col gap-4">
      {states.map((state) => {
        const isActiveCard = state.scenario.id === activeData?.scenario.id;
        // cleared 카드는 my-cleared-scenarios에서 받은 점수 데이터 사용
        const inlineScore: GameScore | null = (() => {
          if (isActiveCard && activeData?.is_finalized) return scoreData;
          if (state.cleared && state.cleared.total_score != null) {
            return {
              participation_id:        state.cleared.participation_id,
              final_return:            state.cleared.final_return,
              correct_strategy_return: null,
              return_score:            null,
              scenario_score:          null,
              diversity_score:         null,
              stability_score:         null,
              total_score:             state.cleared.total_score,
              rank:                    state.cleared.rank,
              total_participants:      state.cleared.total_participants,
              percentile:              null,
            };
          }
          return null;
        })();
        return (
          <FeaturedCard
            key={state.scenario.id}
            state={state}
            activeData={isActiveCard ? activeData : null}
            scoreData={inlineScore}
            starting={starting}
            onStart={() => handleStart(state.scenario.id)}
            onResume={() => navigate('/dashboard/simulator/season')}
            onResult={() => {
              // 활성 시즌이면 현재 결과, cleared 시즌이면 URL search param으로 해당 pid 전달
              if (isActiveCard) navigate('/dashboard/simulator/season/result');
              else if (state.cleared) navigate(`/dashboard/simulator/season/result?pid=${state.cleared.participation_id}`);
            }}
          />
        );
      })}
    </div>
  );
}

// ─── 메인 카드 (기존 디자인 유지) ──────────────────────────────────────────
function FeaturedCard({
  state, activeData, scoreData, starting, onStart, onResume, onResult,
}: {
  state: ScenarioState;
  activeData: ParticipationData | null;
  scoreData: GameScore | null;
  starting: boolean;
  onStart: () => void;
  onResume: () => void;
  onResult: () => void;
}) {
  const { scenario, status, unlockAt } = state;
  const isLocked = status === 'locked';
  const isCleared = status === 'cleared';
  const isActive = status === 'active';
  const isFinalized = status === 'finalized';
  const isAvailable = status === 'available';

  const todayIdx = activeData?.today_index ?? 0;
  const currentValue = activeData?.current_value ?? 0;
  const totalReturn = activeData?.total_return ?? 0;
  const progressPct = isActive ? Math.round((todayIdx / TOTAL_DAYS) * 100) : 0;
  const isUp = totalReturn >= 0;
  const totalScore = scoreData?.total_score ?? null;
  const rank = scoreData?.rank ?? null;

  const onCardClick = () => {
    if (isLocked) return;
    if (isFinalized) { onResult(); return; }
    if (isCleared)   { onResult(); return; }   // cleared 시즌도 결과 페이지로
    if (isActive)    { onResume(); return; }
    if (isAvailable) { onStart();  return; }
  };

  // 잠금 카드는 회색 톤, 그 외는 네이비
  const containerBase = isLocked
    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-2 border-slate-300 cursor-not-allowed'
    : 'bg-[#1A237E] text-white cursor-pointer hover:shadow-lg hover:scale-[1.005] hover:bg-[#1f2a8c] active:scale-[0.998]';

  // 잠금 해제 카운트다운
  const unlockHint = (() => {
    if (!isLocked || !unlockAt) return null;
    const diff = unlockAt.getTime() - Date.now();
    if (diff <= 0) return '곧 해금 예정';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours >= 24) return `약 ${Math.floor(hours / 24)}일 뒤 해금`;
    if (hours >= 1) return `약 ${hours}시간 뒤 해금`;
    const mins = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `약 ${mins}분 뒤 해금`;
  })();

  return (
    <button
      onClick={onCardClick}
      disabled={isLocked || starting}
      aria-label={`시즌 #${scenario.stage} ${isLocked ? '잠금' : scenario.theme}`}
      className={`w-full text-left rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden transition-all ${containerBase} disabled:opacity-90`}
    >
      {/* 배경 장식 (잠금 외) */}
      {!isLocked && (
        <>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent_60%)] pointer-events-none" />
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-400 rounded-full opacity-20 blur-3xl pointer-events-none" />
        </>
      )}

      {/* 좌측: 시즌 정보 */}
      <div className="flex flex-col gap-2 z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${
            isLocked ? 'bg-slate-300 text-slate-600' : 'bg-white/20 text-white'
          }`}>
            SEASON #{scenario.stage}
          </span>
          <h3 className={`text-2xl md:text-3xl font-black tracking-tight ${isLocked ? 'text-slate-600 dark:text-slate-300' : ''}`}>
            {isLocked ? '???' : scenario.theme}
          </h3>
          {isLocked && (
            <span className="material-symbols-outlined text-slate-500" style={{ fontVariationSettings: '"FILL" 1' }}>
              lock
            </span>
          )}
        </div>

        {(isFinalized || isCleared) && (
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1 bg-emerald-400/90 text-[#0a1645] text-sm font-black px-3 py-1 rounded-md tracking-widest">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
              CLEAR
            </span>
            <span className="text-xs text-white/70 font-semibold">시즌 종료 · 결과 확인</span>
          </div>
        )}
        {isActive && (
          <div className="flex items-end gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white/70">Day</span>
              <span className="text-lg font-bold">
                {todayIdx} <span className="text-white/50 text-sm font-normal">/ {TOTAL_DAYS}</span>
              </span>
            </div>
            <div className="w-32 md:w-48 h-2 bg-white/20 rounded-full overflow-hidden mb-1">
              <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
        {isAvailable && (
          <p className="text-sm text-white/70 mt-1">7일 동안 진행되는 가상 투자 시뮬레이션</p>
        )}
        {isLocked && (
          <p className="text-xs font-semibold text-slate-500 mt-1">
            이전 시즌을 클리어하면 해금됩니다{unlockHint ? ` · ${unlockHint}` : ''}
          </p>
        )}
      </div>

      {/* 우측: 상태별 패널 */}
      <div className={`flex gap-6 sm:gap-8 z-10 w-full md:w-auto p-4 rounded-xl ${
        isLocked
          ? 'bg-slate-300/40 border border-slate-400/40'
          : 'bg-white/10 border border-white/20 backdrop-blur-sm'
      }`}>
        {isLocked ? (
          <div className="flex items-center gap-3 w-full">
            <span className="material-symbols-outlined text-3xl text-slate-500">lock</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">잠금</span>
              <span className="text-base font-bold text-slate-600">미해금</span>
            </div>
          </div>
        ) : isFinalized || isCleared ? (
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
        ) : isActive ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-white/70">총 자산 (Equity)</span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl md:text-3xl font-black tracking-tight">
                  ₩{Math.floor(currentValue).toLocaleString()}
                </span>
                <span className={`text-sm font-semibold flex items-center ${isUp ? 'text-emerald-300' : 'text-red-300'}`}>
                  <span className="material-symbols-outlined text-[16px] mr-0.5">
                    {isUp ? 'trending_up' : 'trending_down'}
                  </span>
                  {isUp ? '+' : ''}{totalReturn.toFixed(2)}%
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-white/70 self-center hidden md:block">chevron_right</span>
          </>
        ) : (
          // available
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
  );
}

