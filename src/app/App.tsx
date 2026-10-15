import { Component, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Router, canonicalPathname, useLocation, useScrollManagement } from "../lib/router";
import { ToastProvider } from "../components/ui/Toast";
import { Skeleton } from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { AuthProvider } from "../features/auth/AuthContext";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { Intro } from "../features/intro/Intro";
import { PublicLayout } from "../layouts/PublicLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { AppLayout } from "../layouts/AppLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { matchRoute, type RouteDef } from "./routes";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fullscreen-center" role="alert">
        <h1 className="h3">Something went wrong</h1>
        <p className="muted">An unexpected error stopped this page from loading. Your saved exam data has not been touched.</p>
        <Button onClick={() => window.location.reload()} iconLeft="refresh">
          Reload the page
        </Button>
      </div>
    );
  }
}

function PageFallback() {
  return (
    <div className="page-fallback" aria-busy="true" aria-live="polite">
      <Skeleton className="skeleton--title" />
      <Skeleton className="skeleton--line" />
      <Skeleton className="skeleton--block" />
    </div>
  );
}

function renderRoute(route: RouteDef, pathname: string) {
  const Page = route.component;
  const page = (
    <Suspense fallback={<PageFallback />}>
      <div key={pathname} className="route-fade">
        <Page />
      </div>
    </Suspense>
  );

  let node: ReactNode;
  switch (route.layout) {
    case "public":
      node = <PublicLayout>{page}</PublicLayout>;
      break;
    case "auth":
      node = <AuthLayout>{page}</AuthLayout>;
      break;
    case "app":
      node = <AppLayout title={route.heading ?? ""}>{page}</AppLayout>;
      break;
    case "admin":
      node = <AdminLayout>{page}</AdminLayout>;
      break;
    default:
      node = page;
  }
  return route.protected ? <ProtectedRoute>{node}</ProtectedRoute> : node;
}

function AppRoutes() {
  const { pathname, hash } = useLocation();
  useScrollManagement();

  // The cinematic intro plays when a visitor ENTERS the site on the homepage (every page load,
  // including repeat visits). It is initialised once, so internal navigation never replays it.
  const [introActive, setIntroActive] = useState(() => canonicalPathname(window.location.pathname) === "/");

  // Move focus to the new page's main region after in-app navigation (not on first load, not for #anchors).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!hash) document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname, hash]);

  const route = matchRoute(pathname);
  return (
    <>
      <div id="app-root" {...(introActive ? { inert: true, "aria-hidden": true } : {})}>
        {renderRoute(route, pathname)}
      </div>
      {introActive ? <Intro onDone={() => setIntroActive(false)} /> : null}
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </Router>
    </ErrorBoundary>
  );
}
