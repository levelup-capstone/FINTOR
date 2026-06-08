import { useState } from "react";
import { Outlet } from "react-router";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TourProvider } from "./TourContext";
import { TourOverlay } from "./TourOverlay";
import { Popup } from "../pages/Popup";

export function Layout() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

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

        <button
          onClick={() => setIsPopupOpen(true)}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"
          aria-label="투자 정보 열기"
        >
          <span className="material-symbols-outlined text-2xl">menu_book</span>
        </button>

        <Popup isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)} />
      </div>
    </TourProvider>
  );
}
