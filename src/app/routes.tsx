import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import HomePage from "../features/home/HomePage";

export type LayoutKind = "public" | "auth" | "app" | "admin" | "bare";

export interface RouteDef {
  path: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  layout: LayoutKind;
  /** Requires a valid session (GET /api/me). */
  protected?: boolean;
  /** Heading shown in the application top bar. */
  heading?: string;
}

/**
 * Every URL of the original site keeps working. `.html` and `/pages/…` variants are mapped to
 * these paths by the router (see canonicalPathname in lib/router.tsx).
 */
export const routes: RouteDef[] = [
  { path: "/", component: HomePage, layout: "public" },
  { path: "/learn", component: lazy(() => import("../pages/LearnPage")), layout: "public" },
  { path: "/privacy-policy", component: lazy(() => import("../pages/PrivacyPage")), layout: "public" },
  { path: "/terms", component: lazy(() => import("../pages/TermsPage")), layout: "public" },

  { path: "/login", component: lazy(() => import("../features/auth/LoginPage")), layout: "auth" },
  { path: "/signup", component: lazy(() => import("../features/auth/SignupPage")), layout: "auth" },
  { path: "/forgot-password", component: lazy(() => import("../features/auth/ForgotPasswordPage")), layout: "auth" },
  { path: "/reset-password", component: lazy(() => import("../features/auth/ResetPasswordPage")), layout: "auth" },
  { path: "/verify-email", component: lazy(() => import("../features/auth/VerifyEmailPage")), layout: "auth" },

  { path: "/shared-cat", component: lazy(() => import("../features/shared/SharedCatPage")), layout: "public" },

  { path: "/portal", component: lazy(() => import("../features/dashboard/DashboardPage")), layout: "app", protected: true, heading: "Overview" },
  { path: "/examroom", component: lazy(() => import("../features/exams/ExamRoomPage")), layout: "app", protected: true, heading: "Exam room" },
  { path: "/performance", component: lazy(() => import("../features/performance/PerformancePage")), layout: "app", protected: true, heading: "Performance" },
  { path: "/leaderboard", component: lazy(() => import("../pages/LeaderboardPage")), layout: "app", protected: true, heading: "Leaderboard" },
  { path: "/profile", component: lazy(() => import("../pages/ProfilePage")), layout: "app", protected: true, heading: "Profile" },

  { path: "/examinterface", component: lazy(() => import("../features/exams/ExamInterfacePage")), layout: "bare", protected: true },
  { path: "/admin", component: lazy(() => import("../features/admin/AdminPage")), layout: "admin", protected: true },
];

export const notFoundRoute: RouteDef = {
  path: "*",
  component: lazy(() => import("../pages/NotFoundPage")),
  layout: "public",
};

export function matchRoute(pathname: string): RouteDef {
  return routes.find((route) => route.path === pathname) ?? notFoundRoute;
}
