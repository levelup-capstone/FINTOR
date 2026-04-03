interface ChartSlice {
  id: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  data?: ChartSlice[];
}

const DEFAULT_DATA: ChartSlice[] = [
  { id: 'growth-stock', value: 45, color: '#EF4444' },
  { id: 'coin',         value: 25, color: '#F97316' },
  { id: 'krw',          value: 15, color: '#94A3B8' },
  { id: 'gold',         value: 15, color: '#EAB308' },
];

export function DonutChart({ hoveredId = null, onHover = () => {}, data }: DonutChartProps) {
  const slices = data && data.length > 0 ? data : DEFAULT_DATA;

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="relative flex items-center justify-center w-[200px] h-[200px] md:w-[280px] md:h-[280px]">
      <svg viewBox="-120 -120 240 240" className="w-full h-full transform -rotate-90 drop-shadow-sm">
        {slices.map((item) => {
          const dashArray = (item.value / 100) * circumference;
          const dashOffset = cumulativePercent * circumference;

          cumulativePercent += item.value / 100;

          const isHovered = hoveredId === item.id;
          const isFaded = hoveredId !== null && hoveredId !== item.id;

          return (
            <circle
              key={item.id}
              r={radius}
              cx="0"
              cy="0"
              fill="transparent"
              stroke={item.color}
              strokeWidth={isHovered ? 45 : 35}
              strokeDasharray={`${dashArray} ${circumference}`}
              strokeDashoffset={-dashOffset}
              className="transition-all duration-300 ease-out cursor-pointer"
              style={{ opacity: isFaded ? 0.3 : 1 }}
              onMouseEnter={() => onHover(item.id)}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </svg>
      <div className="absolute z-10 text-center flex flex-col items-center pointer-events-none">
        <p className="text-[8px] md:text-[10px] font-bold text-on-surface-variant tracking-widest">남은 투자 기간</p>
        <p className="text-xl md:text-3xl font-black text-primary font-headline">D-452</p>
      </div>
    </div>
  );
}
