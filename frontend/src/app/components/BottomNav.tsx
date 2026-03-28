export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest flex justify-around items-center p-4 border-t border-surface-container-low z-50">
      <a className="flex flex-col items-center gap-1 text-primary" href="#">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>dashboard</span>
        <span className="text-[10px] font-bold">홈</span>
      </a>
      <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
        <span className="material-symbols-outlined">edit_note</span>
        <span className="text-[10px] font-medium">기록</span>
      </a>
      <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
        <span className="material-symbols-outlined">quiz</span>
        <span className="text-[10px] font-medium">퀴즈</span>
      </a>
      <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
        <span className="material-symbols-outlined">newspaper</span>
        <span className="text-[10px] font-medium">뉴스</span>
      </a>
    </nav>
  );
}
