import { Outlet } from "react-router";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TourProvider } from "./TourContext";
import { TourOverlay } from "./TourOverlay";

export function Layout() {
  return (
    <TourProvider>
      <div className="bg-surface text-on-surface min-h-screen pb-20 md:pb-0 font-body">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
          <Sidebar />
          <main className="flex-1 w-full min-w-0">
            <Outlet />
          </main>
        </div>
        <BottomNav />
        <TourOverlay />
      </div>
    </TourProvider>
  );
}
