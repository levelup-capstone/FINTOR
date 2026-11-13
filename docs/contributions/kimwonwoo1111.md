# 김원우 (kimwonwoo1111) — 기여 상세

**역할: PM · 풀스택**

PM으로 API 명세와 일정을 관리하면서, 백엔드에서는 **뉴스 수집·인기 뉴스, 인증 의존성, 외부 API 호출 제한 대응, 레벨·경험치**를, 프론트엔드에서는 **모의투자 시뮬레이터 화면과 화면–API 연동**을 맡았습니다.

각 항목에는 근거가 되는 커밋과 파일을 붙였습니다. 이후 팀원이 고친 부분은 따로 밝혔습니다.

| 영역 | 주요 작업 | 근거 |
|---|---|---|
| 백엔드 | 뉴스 수집 파이프라인 구축, 24시간 인기 뉴스 | `38fc552`, `0aa175f` |
| 백엔드 | JWT 인증 의존성 `get_current_user`, 레벨 API | `c705702` |
| 백엔드 | 외부 시세 API 호출 제한 대응 (yfinance 배치, KIS 토큰 캐싱) | `37fb8ca`, `1d2a593` |
| 백엔드 · 프론트 | 레벨·경험치 산출 로직과 UI | `ea35949` |
| 백엔드 · 프론트 | 시뮬레이터 평가액 계산, 건너뛴 날짜 처리 | `522e300`, `578a704` |
| 프론트 | 시뮬레이터 4개 화면, 공통 요청 함수 `apiCall`, 대시보드, 온보딩 | `29f3a40`, `578a704` 외 |
| 협업 | API 명세서, 배포 전 개발용 코드 정리 | [문서](https://docs.google.com/document/d/1_JoLlr3xXDROh7A50tuofb9pa-6lR53meIGAr-e6uE8/edit), `6829120` |

> `frontend/src/app/components/ui/*`는 첫 커밋(`5f1dfd6`)에서 Figma Make로 생성해 들어온 UI 컴포넌트 라이브러리(shadcn/ui)입니다. 직접 작성한 코드가 아니어서 아래 기여에 넣지 않았습니다.

---

## 백엔드

### 1. 뉴스 수집 파이프라인 구축 (`38fc552`)

**목표.** 사용자가 매일 읽을 금융 뉴스를 자동으로 모으고, 초보자도 읽기 쉽게 분야와 호재·악재를 붙여 보여 주는 것.

**구현.** → [`utils/news.py`](../../backend/utils/news.py) `run_news_pipeline()`

```
네이버 뉴스 검색 API (키워드: 주식·증시·금리·환율·코인, 최신순)
  → 오늘 발행된 기사만 남김
  → 링크로 이미 저장한 기사 제외            crud.get_news_by_link()
  → 기사 본문 스크래핑 (실패하면 요약문 사용)  scrape_naver_news_body()
  → LLM으로 카테고리·감성·사유 분석
  → DB 저장                                 crud.create_news()
```

- **서버 시작이 막히지 않게**: 첫 수집을 요청 처리와 분리해 백그라운드 스레드로 돌리고, 이후에는 스케줄러가 30분마다 실행합니다. ([`main.py`](../../backend/main.py))
- **외부 요청 실패에 대비**: 키워드별 API 호출 실패, 본문 스크래핑 실패(타임아웃 5초), 날짜 파싱 실패를 각각 건너뛰게 해서 일부가 실패해도 파이프라인 전체가 멈추지 않습니다.

**이후 팀원이 바꾼 부분.** 처음에는 Gemini로 분석했고, 이후 팀원 ngw12358이 OpenAI로 바꾸고 프롬프트를 다듬었습니다. 제목이 비슷한 기사를 걸러 내는 TF-IDF 중복 검사(`86645f9`)도 ngw12358의 작업입니다.

### 2. 24시간 인기 뉴스 (`0aa175f`)

**목표.** 대시보드에 "지금 사람들이 많이 보는 뉴스"를 보여 주는 것.

**설계.** 조회수를 `News` 테이블의 숫자 컬럼으로 두면 "최근 24시간"을 계산할 수 없습니다. 그래서 **클릭 1회 = 1행**인 조회 로그 테이블(`NewsView`)을 따로 두고, 조회 시점 기준으로 집계했습니다.

- `POST /api/v1/market/news/{news_id}/view`: 클릭 시 로그 1행 추가
- `GET /api/v1/market/news/popular`: 최근 24시간 로그를 뉴스별로 세는 서브쿼리를 만들고 `News`와 조인해, 조회수 → 발행일 순으로 상위 5개 반환 → [`crud.get_popular_news_24h()`](../../backend/db/crud.py)
- 뉴스 목록 응답에도 24시간 조회수를 붙이되, 목록의 뉴스 id들만 `IN` 조건으로 한 번에 집계해 뉴스마다 쿼리를 날리지 않게 했습니다. → `crud.get_view_counts_24h_map()`
- 프론트: 대시보드 인기 뉴스 섹션을 1분마다 갱신하고, 카드 클릭 시 조회 기록 후 원문을 새 탭으로 엽니다.

### 3. JWT 인증 의존성과 레벨 API (`c705702`)

- **`get_current_user`** ([`dependencies.py`](../../backend/dependencies.py)): `Authorization: Bearer` 헤더의 JWT를 검증해 현재 사용자를 돌려주는 FastAPI 의존성입니다. 현재 로그인이 필요한 엔드포인트 21개(게임 8, 퀴즈 8, 사용자 3, 설문 2)가 이 함수를 공통으로 씁니다. 토큰 만료, 서명 검증 실패, 존재하지 않는 사용자를 구분해 모두 401로 응답합니다. (토큰 발급은 카카오 로그인 담당 ngw12358이 작성)
- **레벨 API**: `UserLevel` 모델과 레벨 조회 API를 추가하고 대시보드에 연결했습니다.
- **머지 사고 복구**: 브랜치를 합치는 과정에서 사라진 설문 저장 API와 `Survey` 모델을 복원했습니다.

### 4. 외부 시세 API 호출 제한 대응 (`37fb8ca`, `1d2a593`)

대시보드 지수 데이터는 국내 지수는 KIS, 해외 지수는 Finnhub와 yfinance에서 받아 5분마다 갱신합니다. → [`utils/market.py`](../../backend/utils/market.py)

| 문제 | 원인 | 해결 |
|---|---|---|
| yfinance 요청이 차단되거나 Rate Limit에 걸림 | 지수마다 따로 요청해 짧은 시간에 요청이 몰림 | `yf.download()`로 여러 지수를 **한 번에** 요청하고, 브라우저 User-Agent를 단 세션을 사용. Finnhub에서 이미 받은 지수는 yfinance 요청에서 제외 |
| KIS 접근 토큰을 갱신 주기마다 새로 발급 | 토큰을 저장하지 않음 | 발급한 토큰을 메모리에 캐싱해 **23시간 재사용** (토큰 유효기간 24시간에서 1시간 여유) |

### 5. 레벨 · 경험치 (`ea35949` 외)

- **[`crud.grant_exp()`](../../backend/db/crud.py)**: 경험치를 더하고 100 EXP마다 레벨을 올립니다. 한 번에 여러 레벨이 오르는 경우를 `while`로 처리하고, 0 이하 지급은 무시합니다. 레벨업 여부와 오른 레벨 수를 함께 돌려줘 프론트가 레벨업 모달을 띄울 수 있게 했습니다.
- **지급 규칙**
  - 일일 퀴즈 ([`quiz.py`](../../backend/routers/quiz.py)): 정답 1개당 +3, 만점 +5, 연속 참여 10/30/100일 달성 시 +10/+50/+200. 같은 날 다시 완료해도 중복 지급하지 않습니다.
  - 시뮬레이터 시즌 종료 ([`game.py`](../../backend/routers/game.py)): 종합 점수 × 0.5
- **프론트**: [`LevelUpModal.tsx`](../../frontend/src/app/components/LevelUpModal.tsx), 헤더·사이드바·대시보드 레벨 표시, 경험치 획득 경로 안내(`7d11180`)

> 퀴즈 시즌 랭킹에 따른 경험치 지급(`distribute_season_exp`)은 ngw12358이 작성했습니다.

### 6. 시뮬레이터 평가액 계산과 건너뛴 날짜 처리 (`522e300`, `578a704`)

- **평가액 계산 방식**: 1일차 기준으로 계산하던 평가액을 "전날 평가액 × 전날 배분의 하루 가격 변동"을 누적하는 방식으로 바꿨습니다. 매도 시 실현 손익도 전날 대비 하루 손익으로 맞췄습니다.
- **건너뛴 날짜**: 사용자가 매매하지 않고 넘긴 날은 마지막으로 확정한 배분을 이어서 운용한 것으로 채우도록, 백엔드의 배분 저장·정산 양쪽과 캘린더 계산을 함께 고쳤습니다. 이 백엔드 로직은 이후 ngw12358이 기능별 폴더 구조로 리팩터링하면서 [`game.py`](../../backend/routers/game.py)로 옮겼습니다.

---

## 프론트엔드 · 화면 연동

### 7. 모의투자 시뮬레이터 4개 화면

4개 화면을 처음 만들고(`29f3a40`, `578a704`) 이후 계산 방식과 UX를 고쳐 나갔습니다. 게임 진행 API와 일부 연동 코드는 ngw12358이 작성했습니다.

| 화면 | 파일 | 내용 |
|---|---|---|
| 시즌 목록 | [`SimulatorOverview.tsx`](../../frontend/src/app/pages/SimulatorOverview.tsx) | 시즌 카드, 종료한 시즌은 CLEAR 상태와 점수·랭킹 표시 |
| 시즌 대시보드 | [`SimulatorDashboard.tsx`](../../frontend/src/app/pages/SimulatorDashboard.tsx) | 거시 지표, 자산 가격 차트, 그날의 뉴스, 리밸런싱 모달, 매매 확정, 투자 판단 근거 태그 |
| 캘린더 | [`SimulatorCalendar.tsx`](../../frontend/src/app/pages/SimulatorCalendar.tsx) | 7일 타임라인, 일별 배분 변화, 실현 손익, 날짜별 태그·메모, 다음 날로 넘어가기 |
| 결과 | [`SimulatorResult.tsx`](../../frontend/src/app/pages/SimulatorResult.tsx) | 최종 수익, 자산 추이 차트, 점수·랭킹, AI 회고 카드 |

- **비중 합계 100% 초과 방지** (`06218c3`): 한 자산 비중을 바꿀 때 다른 자산 합을 고려해 100%를 넘지 않게 제한하고, 그래도 넘으면 경고 배너를 띄웁니다.
- **진행 흐름** (`5d5c6fc`, `ed5e7e9`): 캘린더에서 바로 다음 날로 넘어갈 수 있게 하되, 그날 매매를 확정한 뒤에만 가능하게 했습니다. 시즌이 바뀌어도 이전 시즌의 태그·메모가 남던 버그(localStorage 키에 참여 id가 없던 문제)를 고쳤습니다.

### 8. 공통 요청 함수 `apiCall` (`578a704`)

시뮬레이터 API 함수마다 반복되던 요청·에러 처리를 하나로 모았습니다. → [`simulatorApi.ts`](../../frontend/src/app/pages/simulatorApi.ts) (파일 자체와 개별 API 함수는 ngw12358이 작성)

```ts
async function apiCall<T>(path: string, init: RequestInit = {}, fallback: T | null = null): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
    });
    if (res.status === 401) {   // 토큰 만료 → 세션 정리 후 로그인 화면으로
      expireSession();
      return fallback;
    }
    const json = await res.json();
    if (json.success) return json.data as T;
    return fallback;
  } catch {
    return fallback;
  }
}
```

- 인증 헤더를 공통으로 붙이고, 401이면 세션을 정리하고 로그인 화면으로 보냅니다. 백엔드의 `get_current_user`가 돌려주는 401과 짝을 이룹니다.
- 백엔드 공통 응답 형식(`{ success, data }`)을 한곳에서 풀어, 화면 코드는 데이터 또는 fallback 값만 받습니다.

### 9. 대시보드 · 뉴스 · 로그인 화면

- [`Dashboard.tsx`](../../frontend/src/app/pages/Dashboard.tsx): 시장 지수, 추천 포트폴리오, 레벨 연동(`6a4e89b`, `c705702`). 이후 인기 뉴스 섹션, 시뮬레이터 4가지 상태 카드(참여 전·오늘 미완료·오늘 완료·시즌 종료), 헤더 시장 지수 티커를 추가했습니다(`fe5f811`).
- [`News.tsx`](../../frontend/src/app/pages/News.tsx): 뉴스 목록, 호재·중립·악재 표시, 받아온 뉴스의 태그를 빈도순 필터로 보여 주는 "태그별로 보기"(`a5da9ae`)
- [`Login.tsx`](../../frontend/src/app/pages/Login.tsx), [`KakaoCallback.tsx`](../../frontend/src/app/pages/KakaoCallback.tsx): 로그인 화면과 카카오 로그인 프론트 라우팅 (배경 영상은 eoqkf, 카카오 로그인 백엔드는 ngw12358)

### 10. 온보딩

- **투자 성향 설문** ([`Survey.tsx`](../../frontend/src/app/pages/Survey.tsx)): 신규 회원 설문 화면과 API 연동, 추천 포트폴리오 표시 (`a2ba00e`, `0649b2e`)
- **사이트 투어** ([`TourContext.tsx`](../../frontend/src/app/components/TourContext.tsx), [`TourOverlay.tsx`](../../frontend/src/app/components/TourOverlay.tsx)): 첫 로그인 사용자에게 대시보드 → 퀴즈 → 시뮬레이터 → 뉴스 순서로 8단계 안내. 안내 상자가 화면 밖으로 나가지 않도록 위치를 자동으로 바꿉니다 (`7320e44`).
- **시뮬레이터 튜토리얼** ([`SimulatorTourOverlay.tsx`](../../frontend/src/app/components/SimulatorTourOverlay.tsx)): 첫 시즌 진입 시 7단계 안내 (`6e0b294`)

---

## 협업

- **API 명세서**: 기능별 요청·응답 형식, 에러 응답, 관련 DB 테이블, 프론트 구현 흐름을 정리했습니다. 카카오 로그인, 설문·포트폴리오, 지수 시세, 포트폴리오 조회, 레벨 조회, 포트폴리오 추천, 뉴스·인기 뉴스를 다룹니다. → [API 명세서 (Google Docs)](https://docs.google.com/document/d/1_JoLlr3xXDROh7A50tuofb9pa-6lR53meIGAr-e6uE8/edit)
- **배포 준비** (`6829120`, `522e300`): 배포 전에 개발용 엔드포인트(`/dev/*`), 테스트 버튼, 개발용 로그인 라우트, 쓰지 않는 코드를 정리했습니다. 프론트·백엔드 `.dockerignore`를 추가해 Docker 빌드 범위를 줄였습니다.

---

## 남은 과제

- **조회 로그 정리 미연결**: 24시간이 지난 조회 로그를 지우는 `crud.cleanup_old_news_views()`를 만들었지만 스케줄러에 등록하지 않아, 현재는 `NewsView` 로그가 계속 쌓입니다. 이 함수를 스케줄러에 등록해야 합니다(`viewed_at` 컬럼에는 이미 인덱스가 있습니다).
- **토큰 캐시 범위**: KIS 토큰 캐시는 프로세스 메모리에 있어서 서버를 다시 시작하면 새로 발급합니다. 서버를 여러 대로 늘리면 Redis 같은 공유 저장소가 필요합니다.
- **경험치 지급의 동시성**: `grant_exp()`는 읽고 더한 뒤 저장하는 방식이라, 같은 사용자에게 동시에 요청이 들어오면 값이 덮어써질 수 있습니다. 행 잠금(`SELECT ... FOR UPDATE`)이나 DB에서 바로 더하는 원자적 갱신으로 바꿔야 합니다.
