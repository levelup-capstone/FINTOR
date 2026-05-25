import { useState, useEffect } from "react";
import { Flame, Sparkles, Globe, Clock, ChevronRight, Eye } from "lucide-react";

type ApiNews = {
  id: number;
  title: string;
  description: string;
  category: string;
  sentiment: string;
  reason: string;
  tag: string;
  link: string;
  pub_date: string;
  created_at: string | null;
  view_count: number;
};

type PopularNews = ApiNews & { view_count: number };

const handleNewsClick = (newsId: number, link: string) => {
  fetch(`/api/v1/market/news/${newsId}/view`, { method: "POST" })
    .catch(() => {});
  window.open(link, "_blank", "noopener,noreferrer");
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
  const [selectedTag, setSelectedTag] = useState<string>("전체");
  const [apiNews, setApiNews] = useState<ApiNews[]>([]);
  const [popularNews, setPopularNews] = useState<PopularNews[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/market/news")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setApiNews(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 인기 뉴스 (24시간 기준 조회수 상위 5개) - 1분마다 자동 새로고침
  useEffect(() => {
    const fetchPopular = () => {
      fetch("/api/v1/market/news/popular")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setPopularNews(json.data);
        })
        .catch(() => {});
    };
    fetchPopular();
    const id = setInterval(fetchPopular, 60_000);
    return () => clearInterval(id);
  }, []);

  // 의미 없는 카테고리는 chip에서 제외
  const EXCLUDED_TAGS = new Set(["오류", "기타"]);

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

  // 실시간 인기 뉴스 (24시간 기준 조회수 상위 5개)
  const trendingNews = popularNews.map((n) => ({
    id: n.id,
    title: n.title,
    source: n.category,
    sentiment: n.sentiment,
    time: formatTimeAgo(n.pub_date),
    tags: [n.category].filter(Boolean),
    link: n.link,
    viewCount: n.view_count,
  }));

  // API로 가져온 뉴스는 전부 그리드 섹션에 표시 (발행일 최신순으로 정렬)
  const sortedApiNews = [...apiNews].sort((a, b) => {
    const ta = new Date(a.pub_date).getTime();
    const tb = new Date(b.pub_date).getTime();
    return tb - ta;
  });
  const gridNews = sortedApiNews.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.reason || n.description,
    source: n.category,
    sentiment: n.sentiment,
    time: formatTimeAgo(n.pub_date),
    tags: [n.category, n.tag].filter(Boolean),
    link: n.link,
    viewCount: n.view_count,
  }));

  const getSentimentBadgeClass = (sentiment: string) => {
    switch (sentiment) {
      case "호재":
        return "text-emerald-700 bg-emerald-100";
      case "악재":
        return "text-red-700 bg-red-100";
      default:
        return "text-primary bg-primary/10";
    }
  };

  // 받아온 뉴스에서 실제 존재하는 태그를 빈도순으로 추출 (오류/기타 제외)
  const tagCounts = new Map<string, number>();
  for (const n of gridNews) {
    for (const t of n.tags) {
      if (!t || EXCLUDED_TAGS.has(t)) continue;
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const dynamicTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  const displayedGridNews =
    activeTab === "custom"
      ? selectedTag === "전체"
        ? gridNews.filter((news) => news.tags.some((tag) => !EXCLUDED_TAGS.has(tag)))
        : gridNews.filter((news) => news.tags.includes(selectedTag))
      : gridNews;

  return (
    <div className="flex-1 space-y-12 animate-in fade-in duration-300 pb-12 w-full">
      {/* Trending News */}
      <section data-tour="news-grid" className="space-y-5">
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
              onClick={() => handleNewsClick(news.id, news.link)}
              className="relative overflow-hidden bg-surface-container-low rounded-xl md:rounded-2xl p-3 md:p-4 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer group border border-surface-container-high hover:border-primary/30 flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-3 md:min-h-[140px]"
            >
              <div className="md:hidden flex-shrink-0 w-6 text-center">
                <span className={`text-2xl font-black italic ${index < 5 ? 'text-primary' : 'text-surface-container-highest/60'}`}>
                  {index + 1}
                </span>
              </div>

              <div className="hidden md:block absolute -right-2 -bottom-4 text-8xl font-black text-surface-container-highest/30 group-hover:text-primary/5 transition-colors duration-500 z-0 pointer-events-none select-none">
                {index + 1}
              </div>

              <div className="relative z-10 flex flex-col justify-center md:justify-start h-full w-full">
                <div className="flex justify-between items-center text-[10px] md:text-xs font-semibold text-on-surface-variant mb-1 md:mb-2">
                  <span className={`px-2 py-0.5 rounded-md flex items-center gap-1 ${getSentimentBadgeClass(news.sentiment)}`}>
                    {news.sentiment}
                  </span>
                  <span className="flex items-center gap-2 opacity-70">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {news.viewCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 hidden md:block" />
                      {news.time}
                    </span>
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
            태그별로 보기
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

        {/* 태그 chip 필터 (태그별로 보기 탭에서만, 실제 뉴스에 존재하는 태그만 동적 생성) */}
        {activeTab === "custom" && (
          <div className="flex flex-wrap gap-2 -mt-2">
            {["전체", ...dynamicTags].map((tag) => {
              const isSelected = selectedTag === tag;
              const count = tag === "전체"
                ? gridNews.filter((n) => n.tags.some((t) => !EXCLUDED_TAGS.has(t))).length
                : tagCounts.get(tag) ?? 0;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 text-sm font-bold rounded-full ring-1 ring-inset transition-all inline-flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-primary text-on-primary ring-primary shadow-sm"
                      : tag === "전체"
                      ? "bg-surface-container-low text-on-surface-variant ring-surface-container-highest hover:bg-surface-container"
                      : `${getTagColor(tag)} hover:opacity-80`
                  }`}
                >
                  {tag === "전체" ? "전체" : `#${tag}`}
                  <span className={`text-xs font-semibold ${isSelected ? "opacity-80" : "opacity-60"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedGridNews.length > 0 ? (
            displayedGridNews.map((news) => (
              <div
                key={news.id}
                onClick={() => handleNewsClick(news.id, news.link)}
                className="group relative flex flex-col gap-4 cursor-pointer p-6 bg-surface-container-lowest border border-surface-container-high rounded-2xl hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/50 transition-all duration-500" />

                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className={`px-2.5 py-1 rounded-md flex items-center gap-1 ${getSentimentBadgeClass(news.sentiment)}`}>
                    {news.sentiment}
                  </span>
                  <span className="text-on-surface-variant flex items-center gap-3 opacity-70">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {news.viewCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {news.time}
                    </span>
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
              </div>
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
