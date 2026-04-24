import { useState, useEffect } from "react";
import { Flame, Sparkles, Globe, Clock, ChevronRight } from "lucide-react";

type ApiNews = {
  id: number;
  title: string;
  description: string;
  category: string;
  sentiment: string;
  reason: string;
  link: string;
  pub_date: string;
  created_at: string | null;
};

function formatTimeAgo(pubDateStr: string): string {
  const pub = new Date(pubDateStr);
  if (isNaN(pub.getTime())) return "";
  const diffMs = Date.now() - pub.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}일 전`;
}

export function News() {
  const [activeTab, setActiveTab] = useState<"custom" | "all">("custom");
  const [apiNews, setApiNews] = useState<ApiNews[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/v1/market/news")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setApiNews(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const myPortfolioTags = ["비트코인", "금", "반도체", "미국주식", "주식"];

  const getTagColor = (tag: string) => {
    const colors: Record<string, string> = {
      비트코인: "bg-orange-100 text-orange-700 ring-orange-200",
      가상화폐: "bg-purple-100 text-purple-700 ring-purple-200",
      금: "bg-yellow-100 text-yellow-700 ring-yellow-200",
      원자재: "bg-amber-100 text-amber-700 ring-amber-200",
      반도체: "bg-blue-100 text-blue-700 ring-blue-200",
      AI: "bg-indigo-100 text-indigo-700 ring-indigo-200",
      주식: "bg-rose-100 text-rose-700 ring-rose-200",
      국내증시: "bg-pink-100 text-pink-700 ring-pink-200",
      미국주식: "bg-sky-100 text-sky-700 ring-sky-200",
      기술주: "bg-cyan-100 text-cyan-700 ring-cyan-200",
      거시경제: "bg-slate-100 text-slate-700 ring-slate-200",
      전기차: "bg-teal-100 text-teal-700 ring-teal-200",
      "2차전지": "bg-emerald-100 text-emerald-700 ring-emerald-200",
      부동산: "bg-green-100 text-green-700 ring-green-200",
      친환경: "bg-lime-100 text-lime-700 ring-lime-200",
      에너지: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200",
    };
    return colors[tag] || "bg-gray-100 text-gray-700 ring-gray-200";
  };

  // 실시간 인기 뉴스는 별도 API 연동 예정 - 현재는 목업 유지
  const trendingNews = [
    { id: 1, title: "연준 금리 동결 유력... 하반기 인하 전망은?", source: "파이낸셜뉴스", time: "1시간 전", tags: ["거시경제", "금리"], link: "#" },
    { id: 2, title: "비트코인, 반감기 앞두고 1억 재돌파 성공", source: "코인투데이", time: "2시간 전", tags: ["비트코인", "가상화폐"], link: "#" },
    { id: 3, title: "안전 자산 선호에 금값 역대 최고치 경신", source: "경제일보", time: "3시간 전", tags: ["금", "원자재"], link: "#" },
    { id: 4, title: "AI 반도체 수요 폭발... 관련주 실적 기대감 쑥", source: "IT조선", time: "4시간 전", tags: ["반도체", "AI"], link: "#" },
    { id: 5, title: "주요 기업 1분기 어닝 서프라이즈 예고", source: "비즈니스워치", time: "5시간 전", tags: ["주식", "국내증시"], link: "#" },
  ];

  // API로 가져온 뉴스는 전부 그리드 섹션에 표시
  const gridNews = apiNews.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.reason || n.description,
    source: n.category,
    time: formatTimeAgo(n.pub_date),
    tags: [n.category, n.sentiment].filter(Boolean),
    link: n.link,
  }));

  const displayedGridNews =
    activeTab === "custom"
      ? gridNews.filter((news) => news.tags.some((tag) => myPortfolioTags.includes(tag)))
      : gridNews;

  return (
    <div className="flex-1 space-y-12 animate-in fade-in duration-300 pb-12 w-full">
      {/* Trending News */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
            <Flame className="w-5 h-5 fill-current" />
          </div>
          <h2 className="text-xl font-extrabold text-on-surface font-headline tracking-tight">
            실시간 인기 뉴스
          </h2>
        </div>

        <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {trendingNews.map((news, index) => (
            <div
              key={news.id}
              className="relative overflow-hidden bg-surface-container-low rounded-xl md:rounded-2xl p-3 md:p-4 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer group border border-surface-container-high hover:border-primary/30 flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-3 md:min-h-[140px]"
            >
              <div className="md:hidden flex-shrink-0 w-6 text-center">
                <span className={`text-2xl font-black italic ${index < 3 ? 'text-primary' : 'text-surface-container-highest/60'}`}>
                  {index + 1}
                </span>
              </div>

              <div className="hidden md:block absolute -right-2 -bottom-4 text-8xl font-black text-surface-container-highest/30 group-hover:text-primary/5 transition-colors duration-500 z-0 pointer-events-none select-none">
                {index + 1}
              </div>

              <div className="relative z-10 flex flex-col justify-center md:justify-start h-full w-full">
                <div className="flex justify-between items-center text-[10px] md:text-xs font-semibold text-on-surface-variant mb-1 md:mb-2">
                  <span className="text-primary flex items-center gap-1">
                    <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {news.source}
                  </span>
                  <span className="flex items-center gap-1 opacity-70">
                    <Clock className="w-3 h-3 hidden md:block" />
                    {news.time}
                  </span>
                </div>

                <h3 className="font-bold text-on-surface line-clamp-1 md:line-clamp-2 text-sm group-hover:text-primary transition-colors leading-relaxed tracking-tight">
                  {news.title}
                </h3>

                <div className="hidden md:flex flex-wrap gap-1.5 mt-auto pt-3">
                  {news.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md ring-1 ring-inset ${getTagColor(tag)}`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-surface-container-high" />

      {/* Tabbed News Grid */}
      <section className="space-y-6">
        <div className="flex bg-surface-container-high p-1.5 rounded-xl w-full max-w-md">
          <button
            onClick={() => setActiveTab("custom")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${
              activeTab === "custom"
                ? "bg-white text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
            }`}
          >
            <Sparkles className={`w-4 h-4 ${activeTab === "custom" ? "fill-primary/20 text-primary" : ""}`} />
            내 자산 맞춤
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${
              activeTab === "all"
                ? "bg-white text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
            }`}
          >
            <Globe className="w-4 h-4" />
            전체 뉴스
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedGridNews.length > 0 ? (
            displayedGridNews.map((news) => (
              <a
                key={news.id}
                href={news.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col gap-4 cursor-pointer p-6 bg-surface-container-lowest border border-surface-container-high rounded-2xl hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/50 transition-all duration-500" />

                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-md flex items-center gap-1">
                    {news.source}
                  </span>
                  <span className="text-on-surface-variant flex items-center gap-1 opacity-70">
                    <Clock className="w-3.5 h-3.5" />
                    {news.time}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-extrabold text-base text-on-surface group-hover:text-primary transition-colors line-clamp-2 leading-snug tracking-tight">
                    {news.title}
                  </h3>
                  <p className="text-sm text-on-surface-variant line-clamp-3 leading-relaxed opacity-80">
                    {news.description}
                  </p>
                </div>

                <div className="mt-auto pt-4 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {news.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md ring-1 ring-inset ${getTagColor(tag)}`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-white transition-all duration-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </a>
            ))
          ) : (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-dashed border-surface-container-high">
              <Sparkles className="w-12 h-12 text-surface-container-highest mb-4" />
              <p className="font-bold text-lg text-on-surface mb-2">맞춤 뉴스가 없습니다</p>
              <p className="text-sm">현재 보유하신 자산과 관련된 최신 뉴스가 없습니다.<br/>새로운 자산을 추가해보세요.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
