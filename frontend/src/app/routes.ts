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
import { SimulatorResult } from "./pages/SimulatorResult";
import { Quiz } from "./pages/Quiz";
import { Settings } from "./pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Login,
  },
  {
    path: "/oauth/kakao",
    Component: KakaoCallback,
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
      { path: "simulator/season/result", Component: SimulatorResult },
      { path: "quiz", Component: Quiz },
      { path: "settings", Component: Settings },
    ],
  },
]);
