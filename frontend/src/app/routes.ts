import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { KakaoCallback } from "./pages/KakaoCallback";
import { Survey } from "./pages/Survey";
import { News } from "./pages/News";
import { SimulatorOverview } from "./pages/SimulatorOverview";
import { SimulatorDashboard } from "./pages/SimulatorDashboard";
import { SimulatorCalendar } from "./pages/SimulatorCalendar";
import { DevAuth } from "./pages/DevAuth"; // [DEV ONLY] 배포 전 제거

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Login,
  },
  {
    path: "/oauth/kakao",
    Component: KakaoCallback,
  },
  // [DEV ONLY] 모바일 테스트용 — 배포 전 제거
  {
    path: "/dev-auth",
    Component: DevAuth,
  },
  {
    path: "/survey",
    Component: Survey,
  },
  {
    path: "/dashboard",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "news", Component: News },
      { path: "simulator", Component: SimulatorOverview },
      { path: "simulator/season", Component: SimulatorDashboard },
      { path: "simulator/season/calendar", Component: SimulatorCalendar },
    ],
  },
]);
