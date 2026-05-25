export type TourStep = {
  /** 식별자 (디버깅용) */
  id: string;
  /** 단계가 시작될 페이지 경로 */
  path: string;
  /** 타겟 요소의 data-tour 속성 값 */
  target: string;
  /** 안내 박스 제목 */
  title: string;
  /** 안내 박스 본문 */
  body: string;
  /** "다음" 버튼 라벨 (마지막은 "완료") */
  nextLabel: string;
};

/**
 * 첫 로그인 사용자에게 보여줄 사이트 투어 단계.
 * 순서는 자연스러운 탐색 흐름을 따르며, 페이지가 바뀌는 단계에서는
 * TourContext가 자동으로 해당 path로 navigate 합니다.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'level',
    path: '/dashboard',
    target: 'level-section',
    title: '🎯 내 학습 레벨',
    body: '일일 퀴즈와 시뮬레이션으로 경험치를 쌓고 레벨을 올려보세요. ⓘ 버튼을 누르면 경험치 획득 경로를 자세히 볼 수 있어요.',
    nextLabel: '다음',
  },
  {
    id: 'mission',
    path: '/dashboard',
    target: 'today-mission',
    title: '📅 매일의 학습 미션',
    body: '오늘의 시뮬레이션과 퀴즈가 매일 새로 열립니다. 매일 풀면 streak이 쌓이고, 10·30·100일 달성 시 보너스 EXP를 받아요.',
    nextLabel: '다음',
  },
  {
    id: 'popular-news',
    path: '/dashboard',
    target: 'popular-news',
    title: '🔥 핫한 시장 뉴스',
    body: '최근 24시간 조회수 기준 인기 뉴스 TOP 5입니다. 1위는 카드 형태, 2~5위는 리스트로 표시되며 클릭하면 원문으로 이동합니다.',
    nextLabel: '다음',
  },
  {
    id: 'header-ticker',
    path: '/dashboard',
    target: 'header-ticker',
    title: '📈 실시간 시장 지수',
    body: '헤더 하단 띠에서 주요 7개 지수(S&P 500, KOSPI, 비트코인, USD/KRW 등)가 실시간으로 흐릅니다.',
    nextLabel: '퀴즈 보기',
  },
  {
    id: 'daily-quiz',
    path: '/dashboard/quiz',
    target: 'daily-quiz-card',
    title: '✏ 오늘의 퀴즈',
    body: '매일 6문제, 자정에 자동 갱신됩니다. 정답 1개당 +3 EXP, 만점이면 보너스 +5 EXP를 받아요.',
    nextLabel: '다음',
  },
  {
    id: 'season-challenge',
    path: '/dashboard/quiz',
    target: 'season-challenge',
    title: '🏆 시즌 챌린지',
    body: '무한 챌린지에 도전해 점수를 쌓고, 다른 사용자와 랭킹을 겨뤄보세요. 신기록 달성 시 EXP 보너스도 있어요.',
    nextLabel: '시뮬레이터 보기',
  },
  {
    id: 'simulator-overview',
    path: '/dashboard/simulator',
    target: 'simulator-overview',
    title: '🎮 투자 시뮬레이션',
    body: '7일짜리 가상 시즌에 참여해 자산을 배분하고 결과를 확인해보세요. 시즌 완료 시 점수에 따라 EXP를 받습니다.',
    nextLabel: '뉴스 보기',
  },
  {
    id: 'news',
    path: '/dashboard/news',
    target: 'news-grid',
    title: '📰 시장 뉴스',
    body: '호재·악재 라벨이 자동 분석되어 표시됩니다. 상단 탭과 태그 칩으로 관심 분야만 필터링해 볼 수 있어요.',
    nextLabel: '시작하기',
  },
];

export const TOUR_SEEN_KEY = 'fintor_tour_seen';
