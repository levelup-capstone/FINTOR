export type SimulatorTourStep = {
  id: string;
  target: string;
  title: string;
  body: string;
};

/**
 * 시즌을 처음 시작한 사용자에게 SimulatorDashboard 사용법을 안내하는 단계.
 * 페이지 이동 없이 같은 페이지(SimulatorDashboard) 내에서 진행됩니다.
 */
export const SIMULATOR_TOUR_STEPS: SimulatorTourStep[] = [
  {
    id: 'banner',
    target: 'sim-banner',
    title: '🎬 시즌 시나리오',
    body: '"고금리 장기화" 같은 7일짜리 가상 시장 상황입니다. 매일 자산을 배분하며 Day 7까지 진행하면 점수와 EXP를 받아요.',
  },
  {
    id: 'macros',
    target: 'sim-macros',
    title: '📊 시장 환경 지표',
    body: 'CPI(물가), 기준금리, 환율, VIX(공포지수)로 현재 시장 분위기를 파악하세요. 카드를 클릭하면 추이 차트와 설명을 볼 수 있어요.',
  },
  {
    id: 'asset-prices',
    target: 'sim-asset-prices',
    title: '💰 자산별 일일 변동',
    body: '각 자산의 오늘 가격과 7일 추세를 확인할 수 있어요. 어제 대비 등락률도 함께 표시됩니다.',
  },
  {
    id: 'news',
    target: 'sim-news',
    title: '📰 시장 단서 뉴스',
    body: '매일 새 뉴스가 등장합니다. 일부에는 자산 변동의 힌트가 숨어 있으니 잘 읽고 전략을 세워보세요. Day 탭으로 지난 뉴스도 다시 볼 수 있어요.',
  },
  {
    id: 'equity-chart',
    target: 'sim-equity-chart',
    title: '📈 내 평가액 추이',
    body: '시작 자금 대비 오늘까지의 포트폴리오 평가액 변화를 한눈에 볼 수 있어요. 시작선과 오늘 시점이 표시됩니다.',
  },
  {
    id: 'rebalancing',
    target: 'sim-rebalancing',
    title: '💼 자산 배분 · 매매 확정',
    body: '이 영역을 눌러 오늘의 자산 비중을 조정하세요. 비중 합이 100%가 되어야 매매 확정 가능하며, 확정 후 자정이 지나면 다음 날로 자동 진행됩니다.',
  },
  {
    id: 'calendar-link',
    target: 'sim-calendar-link',
    title: '📅 지난 기록 보기',
    body: '캘린더 버튼으로 Day별 매매 기록, 자산 배분 변화, 수익률을 자세히 확인할 수 있어요.',
  },
];

export const SIMULATOR_TOUR_SEEN_KEY = 'fintor_simulator_tour_seen';
