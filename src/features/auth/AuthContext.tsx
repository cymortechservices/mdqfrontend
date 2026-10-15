import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { request, errorMessage } from "../../lib/api";
import { useNavigate } from "../../lib/router";
import type { User } from "../../types/api";

type Status = "idle" | "loading" | "authed" | "anon" | "error";

interface AuthValue {
  status: Status;
  user: User | null;
  error: string | null;
  /** Load the session once (no-op if already loaded). Called by ProtectedRoute. */
  ensure: () => void;
  /** Force a fresh GET /api/me. */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}

/**
 * Session state. Authentication is the existing session cookie; the only way to know whether it
 * is valid is GET /api/me, exactly like the original `requireSession()`.
 *   - 200            → authenticated, `data.user` is the profile
 *   - 401 / 403      → anonymous → ProtectedRoute redirects to /login
 *   - anything else  → "error" (backend down / offline) with a retry, instead of a misleading login redirect
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await request<{ user?: User; error?: string }>("/api/me");
      if (result.ok && result.data.user) {
        setUser(result.data.user);
        setStatus("authed");
      } else if (result.status === 401 || result.status === 403) {
        setUser(null);
        setStatus("anon");
      } else {
        setError(result.data.error || `Could not verify your session (HTTP ${result.status}).`);
        setStatus("error");
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setStatus("error");
    }
  }, []);

  const ensure = useCallback(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    started.current = true;
    await load();
  }, [load]);

  const logout = useCallback(async () => {
    try {
      await request("/logout", { method: "POST" });
    } catch {
      /* The original ignored failures here too and still left the page. */
    }
    navigate("/login", { replace: true });
    started.current = false;
    setUser(null);
    setStatus("idle");
  }, [navigate]);

  const value = useMemo(
    () => ({ status, user, error, ensure, refresh, logout }),
    [status, user, error, ensure, refresh, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
