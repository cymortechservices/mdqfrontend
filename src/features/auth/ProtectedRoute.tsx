import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "../../lib/router";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Feedback";
import { useAuth } from "./AuthContext";
import { Logo } from "../../components/brand/Logo";

/**
 * Guards authenticated routes. The server remains the authority (every API call re-checks the
 * session); this only decides what to render and where to send an anonymous visitor.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, error, ensure, refresh } = useAuth();
  const { pathname, search } = useLocation();

  useEffect(() => {
    ensure();
  }, [ensure]);

  if (status === "anon") {
    const next = `${pathname}${search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} />;
  }

  if (status === "error") {
    return (
      <div className="fullscreen-center">
        <Logo to={null} />
        <h1 className="h3">We couldn’t check your session</h1>
        <p className="muted">{error}</p>
        <Button onClick={() => void refresh()} iconLeft="refresh">
          Try again
        </Button>
      </div>
    );
  }

  if (status !== "authed") {
    return (
      <div className="fullscreen-center" aria-busy="true">
        <Logo to={null} />
        <Spinner size="lg" label="Checking your session" />
      </div>
    );
  }

  return <>{children}</>;
}
