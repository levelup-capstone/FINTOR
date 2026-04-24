import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { KakaoCallback } from "./pages/KakaoCallback";
import { Survey } from "./pages/Survey";
import { News } from "./pages/News";

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
    ],
  },
]);
