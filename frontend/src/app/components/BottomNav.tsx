import { Link, useLocation } from 'react-router';

export function BottomNav() {
  const location = useLocation();

  const items = [
    { label: '홈', to: '/dashboard', icon: 'dashboard' },
    { label: '기록', to: '/dashboard/record', icon: 'edit_note' },
    { label: '퀴즈', to: '/dashboard/quiz', icon: 'quiz' },
    { label: '뉴스', to: '/dashboard/news', icon: 'newspaper' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest flex justify-around items-center p-4 border-t border-surface-container-low z-50">
      {items.map((item) => {
        const isActive =
          item.to === '/dashboard'
            ? location.pathname === '/dashboard' || location.pathname === '/dashboard/'
            : location.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: '"FILL" 1' } : undefined}
            >
              {item.icon}
            </span>
            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
