import { useState, useEffect } from "react";
import { DonutChart } from "../components/DonutChart";

export function Dashboard() {
  // 현재 호버된 자산 항목을 추적 (도넛 차트와 자산 카드 간 연동에 사용)
  // null이면 아무것도 강조 안 됨, 'stock'/'coin'/'krw'/'gold' 중 하나면 해당 항목 강조
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);

  type IndexItem = { price: number; change_rate: number; change_value: number; source: string };
  const [marketData, setMarketData] = useState<Record<string, IndexItem> | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState(false);
  const [marketUpdatedAt, setMarketUpdatedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('domestic');

  const fetchMarket = async () => {
    setMarketLoading(true);
    setMarketError(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch('http://localhost:8000/api/v1/market/indices', { signal: controller.signal });
      const json = await res.json();
      if (json.success) {
        setMarketData(json.data);
        setMarketUpdatedAt(json.data.updated_at ?? null);
      } else {
        setMarketError(true);
      }
    } catch (e) {
      console.error('시장 지수 조회 실패:', e);
      setMarketError(true);
    } finally {
      clearTimeout(timeoutId);
      setMarketLoading(false);
    }
  };

  useEffect(() => { fetchMarket(); }, []);

  const formatPrice = (key: string, price: number): string => {
    if (key === 'BTC_KRW') return `${(price / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만`;
    if (['USD_KRW','JPY_KRW','EUR_KRW'].includes(key)) return price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUpdatedAt = (iso: string): string => {
    const diff = Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000 / 60);
    if (diff < 1) return '방금 전';
    return `${diff}분 전`;
  };

  const INDEX_LABEL: Record<string, string> = {
    KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', VKOSPI: 'VKOSPI',
    KRX200IT: 'KRX IT', KRXHEALTH: 'KRX 헬스케어', BBIG: 'BBIG',
    SP500: 'S&P 500', NASDAQ100: 'NASDAQ 100', DOW30: '다우 30',
    SOX: '반도체 (SOX)', NBI: 'NBI', FANGPLUS: 'FANG+', VIX: 'VIX', US10Y: '미국 10년물',
    NIKKEI225: '니케이 225', HANSENG: '항셍', SSE: '상해종합', EUROSTOXX50: '유로스톡스 50',
    USD_KRW: 'USD/KRW', JPY_KRW: 'JPY/KRW', EUR_KRW: 'EUR/KRW',
    DXY: '달러 인덱스', USD_JPY: 'USD/JPY', EUR_USD: 'EUR/USD',
    WTI: 'WTI 원유', GOLD: '금', SILVER: '은', COPPER: '구리', NATGAS: '천연가스',
    BTC_KRW: '비트코인',
  };

  const CATEGORIES = [
    { key: 'domestic',  label: '국내',       keys: ['KOSPI','KOSDAQ','VKOSPI','KRX200IT','KRXHEALTH','BBIG'] },
    { key: 'us',        label: '미국',       keys: ['SP500','NASDAQ100','DOW30','SOX','NBI','FANGPLUS','VIX','US10Y'] },
    { key: 'asia',      label: '아시아·유럽', keys: ['NIKKEI225','HANSENG','SSE','EUROSTOXX50'] },
    { key: 'fx',        label: '환율',       keys: ['USD_KRW','JPY_KRW','EUR_KRW','DXY','USD_JPY','EUR_USD'] },
    { key: 'commodity', label: '원자재',     keys: ['WTI','GOLD','SILVER','COPPER','NATGAS'] },
    { key: 'crypto',    label: '암호화폐',   keys: ['BTC_KRW'] },
  ];

  return (
    <div className="flex-1 space-y-8">

      {/* ─── 섹션 1: 포트폴리오 히어로 ───────────────────────────────────────
          사용자의 투자 성향, 자산 배분 비율, 레벨/XP를 한눈에 보여주는 메인 카드
          DonutChart 컴포넌트와 hoveredAsset 상태를 공유해서
          카드 호버 ↔ 차트 강조가 서로 연동됨
      ──────────────────────────────────────────────────────────────────────── */}
      <section className="bg-surface-container-lowest rounded-xl flex flex-col relative overflow-hidden">

        {/* 레벨 & XP 바 영역
            현재 레벨과 경험치 진행도를 표시
            XP 비율(49%)은 백엔드 연동 시 실제 값으로 교체 필요 */}
        <div className="w-full bg-slate-100/50 dark:bg-slate-900/50 p-6 md:p-8 rounded-t-xl border-b border-surface-container-low">
          <div className="space-y-3">
            <div className="flex justify-between px-1 items-baseline">
              <span className="text-xl md:text-3xl font-black text-[#1A237E] dark:text-indigo-300 font-headline uppercase tracking-tighter italic drop-shadow-sm">
                LEVEL 12
              </span>
              <span className="text-[9px] md:text-[10px] font-bold text-slate-600 dark:text-slate-400 tracking-wider uppercase">
                XP 2,450 / 5,000
              </span>
            </div>
            {/* XP 진행 바: width 값이 현재 경험치 비율 (2450/5000 = 49%) */}
            <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-[#1A237E] via-[#7C4DFF] to-[#D500F9] rounded-full"
                style={{ width: "49%" }}
              ></div>
            </div>
          </div>

          {/* 경험치 획득 액션 버튼들 */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-outline-variant/30 rounded-lg text-[9px] md:text-[11px] font-bold text-[#1A237E] dark:text-indigo-300 hover:bg-surface-container-low transition-colors shadow-sm">
              <span className="material-symbols-outlined text-sm">
                edit_note
              </span>
              기록 쓰고 경험치 쌓기
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-outline-variant/30 rounded-lg text-[9px] md:text-[11px] font-bold text-[#1A237E] dark:text-indigo-300 hover:bg-surface-container-low transition-colors shadow-sm">
              <span className="material-symbols-outlined text-sm">
                quiz
              </span>
              퀴즈로 경험치 쌓기
            </button>
          </div>
        </div>

        {/* 자산 배분 영역: AI 추천 투자 성향 + 자산 카드 + 도넛 차트 */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="flex-1 space-y-6 md:space-y-8 w-full">

            {/* AI 추천 투자 성향 헤더 */}
            <header>
              <span className="inline-block px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[8px] md:text-[10px] font-bold tracking-widest uppercase mb-2 md:mb-4">
                AI Recommendation
              </span>
              <div className="flex items-center gap-3 md:gap-4 mb-1 md:mb-3">
                <h1 className="text-2xl md:text-4xl font-black font-headline tracking-tight text-[#000827] dark:text-white">
                  안정적 관리형
                </h1>
                <button className="inline-flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 bg-white border border-outline-variant rounded-lg text-[10px] md:text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-xs md:text-sm">
                    edit
                  </span>
                  자산 비율 수정
                </button>
              </div>
            </header>

            {/* 자산 카드 그리드 (주식/코인/원화/금)
                각 카드에 마우스를 올리면 hoveredAsset 상태가 변경되어
                오른쪽 DonutChart의 해당 조각이 함께 강조됨 */}
            <div className="grid grid-cols-4 sm:grid-cols-2 lg:grid-cols-2 gap-2 md:gap-5">

              {/* 주식 카드 */}
              <div
                className={`flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 p-2 md:p-5 rounded-xl md:rounded-2xl bg-surface-container-low transition-all cursor-pointer ${hoveredAsset === 'stock' ? 'shadow-md border-outline-variant scale-[1.02]' : 'border-transparent hover:shadow-md hover:border-outline-variant'} text-center sm:text-left border`}
                onMouseEnter={() => setHoveredAsset('stock')}
                onMouseLeave={() => setHoveredAsset(null)}
              >
                <div
                  className="w-2.5 h-2.5 md:w-4 md:h-4 rounded-full flex-shrink-0 transition-transform duration-300"
                  style={{ backgroundColor: "#1A237E", transform: hoveredAsset === 'stock' ? 'scale(1.2)' : 'scale(1)' }}
                ></div>
                <div className="flex flex-col">
                  <p className="text-[8px] md:text-xs text-on-surface-variant font-extrabold uppercase tracking-tight">
                    주식
                  </p>
                  <p className="text-[10px] sm:text-lg md:text-2xl font-black font-headline text-primary">
                    45%
                  </p>
                </div>
              </div>

              {/* 코인 카드 */}
              <div
                className={`flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 p-2 md:p-5 rounded-xl md:rounded-2xl bg-surface-container-low transition-all cursor-pointer ${hoveredAsset === 'coin' ? 'shadow-md border-outline-variant scale-[1.02]' : 'border-transparent hover:shadow-md hover:border-outline-variant'} text-center sm:text-left border`}
                onMouseEnter={() => setHoveredAsset('coin')}
                onMouseLeave={() => setHoveredAsset(null)}
              >
                <div
                  className="w-2.5 h-2.5 md:w-4 md:h-4 rounded-full flex-shrink-0 transition-transform duration-300"
                  style={{ backgroundColor: "#7C4DFF", transform: hoveredAsset === 'coin' ? 'scale(1.2)' : 'scale(1)' }}
                ></div>
                <div className="flex flex-col">
                  <p className="text-[8px] md:text-xs text-on-surface-variant font-extrabold uppercase tracking-tight">
                    코인
                  </p>
                  <p className="text-[10px] sm:text-lg md:text-2xl font-black font-headline text-primary">
                    25%
                  </p>
                </div>
              </div>

              {/* 원화 카드 */}
              <div
                className={`flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 p-2 md:p-5 rounded-xl md:rounded-2xl bg-surface-container-low transition-all cursor-pointer ${hoveredAsset === 'krw' ? 'shadow-md border-outline-variant scale-[1.02]' : 'border-transparent hover:shadow-md hover:border-outline-variant'} text-center sm:text-left border`}
                onMouseEnter={() => setHoveredAsset('krw')}
                onMouseLeave={() => setHoveredAsset(null)}
              >
                <div
                  className="w-2.5 h-2.5 md:w-4 md:h-4 rounded-full flex-shrink-0 transition-transform duration-300"
                  style={{ backgroundColor: "#90A4AE", transform: hoveredAsset === 'krw' ? 'scale(1.2)' : 'scale(1)' }}
                ></div>
                <div className="flex flex-col">
                  <p className="text-[8px] md:text-xs text-on-surface-variant font-extrabold uppercase tracking-tight">
                    원화
                  </p>
                  <p className="text-[10px] sm:text-lg md:text-2xl font-black font-headline text-primary">
                    15%
                  </p>
                </div>
              </div>

              {/* 금 카드 */}
              <div
                className={`flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 p-2 md:p-5 rounded-xl md:rounded-2xl bg-surface-container-low transition-all cursor-pointer ${hoveredAsset === 'gold' ? 'shadow-md border-outline-variant scale-[1.02]' : 'border-transparent hover:shadow-md hover:border-outline-variant'} text-center sm:text-left border`}
                onMouseEnter={() => setHoveredAsset('gold')}
                onMouseLeave={() => setHoveredAsset(null)}
              >
                <div
                  className="w-2.5 h-2.5 md:w-4 md:h-4 rounded-full flex-shrink-0 transition-transform duration-300"
                  style={{ backgroundColor: "#FFB300", transform: hoveredAsset === 'gold' ? 'scale(1.2)' : 'scale(1)' }}
                ></div>
                <div className="flex flex-col">
                  <p className="text-[8px] md:text-xs text-on-surface-variant font-extrabold uppercase tracking-tight">
                    금
                  </p>
                  <p className="text-[10px] sm:text-lg md:text-2xl font-black font-headline text-primary">
                    15%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 도넛 차트: hoveredAsset 상태를 받아 해당 조각을 강조해서 렌더링
              onHover로 차트 쪽에서 호버해도 자산 카드가 함께 반응함 */}
          <div className="flex flex-col items-center">
            <DonutChart hoveredId={hoveredAsset} onHover={setHoveredAsset} />
          </div>
        </div>
      </section>

      {/* ─── 섹션 2: 일일 리포트 요약 ────────────────────────────────────────
          AI가 생성한 오늘의 포트폴리오 요약 메시지를 표시
          백엔드 연동 시 텍스트를 API 응답으로 교체 필요
      ──────────────────────────────────────────────────────────────────────── */}
      <section className="bg-[#1A237E] rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
        <div className="flex-1">
          <h3 className="text-xs font-bold font-headline mb-1 uppercase tracking-wider text-blue-200">
            일일 리포트 요약
          </h3>
          <p className="text-sm md:text-base font-medium leading-relaxed text-white">
            현재 포트폴리오는 안정적이며, 기술주 비중이 소폭
            상승했습니다. 시장의 변동성에 대응하여 분산 투자가
            필요한 시점입니다.
          </p>
        </div>
        {/* 상세 리포트 페이지로 이동 버튼 (라우팅 연결 필요) */}
        <button className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#1A237E] rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors whitespace-nowrap shadow-md">
          상세 리포트 보기
          <span className="material-symbols-outlined text-sm">
            arrow_forward
          </span>
        </button>
      </section>

      {/* ─── 섹션 3: 실시간 시장 지수 ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-extrabold text-primary font-headline">실시간 시장 지수</h2>
          <span className="text-xs text-on-surface-variant font-medium">
            {marketLoading
              ? '데이터 로딩 중... (첫 로드는 약 20~30초 소요)'
              : marketError
              ? '데이터 불러오기 실패'
              : marketUpdatedAt
              ? `업데이트: ${formatUpdatedAt(marketUpdatedAt)}`
              : '업데이트 정보 없음'}
          </span>
        </div>

        {/* 카테고리 탭 */}
        {!marketLoading && !marketError && (
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveTab(cat.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === cat.key
                    ? 'bg-[#1A237E] text-white'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-lowest'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* 카드 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {marketError ? (
            <div className="col-span-2 md:col-span-3 flex flex-col items-center justify-center gap-3 py-8">
              <div className="flex items-center gap-2 text-sm font-bold text-on-surface-variant">
                <span className="material-symbols-outlined text-base">wifi_off</span>
                데이터를 불러오지 못했습니다.
              </div>
              <button
                onClick={fetchMarket}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A237E] text-white text-sm font-bold hover:bg-[#1A237E]/90 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                다시 시도
              </button>
            </div>
          ) : marketLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface-container-low p-5 rounded-xl animate-pulse">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-3" />
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24" />
              </div>
            ))
          ) : (
            (CATEGORIES.find((c) => c.key === activeTab)?.keys ?? []).map((key) => {
              const item = marketData?.[key];
              const isUp = item ? item.change_rate >= 0 : true;
              return (
                <div key={key} className="bg-surface-container-low p-5 rounded-xl transition-all hover:bg-surface-container-lowest cursor-default">
                  <p className="text-xs font-bold text-on-surface-variant mb-1">{INDEX_LABEL[key] ?? key}</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl font-black font-headline">
                      {item ? formatPrice(key, item.price) : '—'}
                    </span>
                    {item && (
                      <div className={`flex flex-col text-[10px] font-bold ${isUp ? 'text-error' : 'text-blue-700'}`}>
                        <span className="flex items-center">
                          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>
                            {isUp ? 'arrow_drop_up' : 'arrow_drop_down'}
                          </span>
                          {Math.abs(item.change_rate).toFixed(2)}%
                        </span>
                        <span className="text-on-surface-variant pl-1">
                          {isUp ? '+' : ''}{item.change_value.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
