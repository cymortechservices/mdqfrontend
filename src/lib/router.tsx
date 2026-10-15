/**
 * A small History-API router (no dependency).
 *
 * Why not React Router? The build environment used for this redesign could not reach the npm
 * registry, so the router is implemented in-house. The surface is intentionally tiny and
 * React-Router-shaped (`Link`, `useNavigate`, `useLocation`, `useSearchParams`) so swapping it
 * for react-router-dom later is a mechanical change confined to imports.
 *
 * Legacy URLs are canonicalised on entry so every old link keeps working:
 *   /pages/login.html → /login      /login.html → /login      /index.html → /
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  /** Increments on every navigation, including to the same URL. */
  key: number;
  state?: unknown;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

interface RouterValue {
  location: Location;
  navigate: (to: string, options?: NavigateOptions) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/** Map legacy `.html` / `/pages/` paths onto clean routes. */
export function canonicalPathname(raw: string): string {
  let path = raw || "/";
  path = path.replace(/^\/pages(?=\/|$)/, "");
  path = path.replace(/\.html$/i, "");
  if (path === "" || path === "/index") path = "/";
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

function readLocation(key: number, state?: unknown): Location {
  const { pathname, search, hash } = window.location;
  return { pathname: canonicalPathname(pathname), search, hash, key, state };
}

function splitTarget(to: string): { pathname: string; search: string; hash: string } {
  const url = new URL(to, window.location.origin);
  return { pathname: canonicalPathname(url.pathname), search: url.search, hash: url.hash };
}

export function Router({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(() => readLocation(0, window.history.state?.usr));

  // Canonicalise legacy URLs once on entry (keeps query + hash).
  useLayoutEffect(() => {
    const canonical = canonicalPathname(window.location.pathname);
    if (canonical !== window.location.pathname) {
      window.history.replaceState(window.history.state, "", `${canonical}${window.location.search}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const onPop = () => setLocation((previous) => readLocation(previous.key + 1, window.history.state?.usr));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, options: NavigateOptions = {}) => {
    const target = splitTarget(to);
    const url = `${target.pathname}${target.search}${target.hash}`;
    const historyState = { usr: options.state };
    if (options.replace) window.history.replaceState(historyState, "", url);
    else window.history.pushState(historyState, "", url);
    setLocation((previous) => ({ ...target, key: previous.key + 1, state: options.state }));
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error("Router context is missing");
  return value;
}

export function useLocation(): Location {
  return useRouter().location;
}

export function useNavigate(): (to: string, options?: NavigateOptions) => void {
  return useRouter().navigate;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useRouter().location;
  return useMemo(() => new URLSearchParams(search), [search]);
}

/** True when the current path equals `to` (or is nested under it when `end` is false). */
export function useIsActive(to: string, end = true): boolean {
  const { pathname } = useLocation();
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
  state?: unknown;
}

function isModifiedEvent(event: MouseEvent) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

export function Link({ to, replace, state, onClick, target, children, ...rest }: LinkProps) {
  const navigate = useNavigate();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || isModifiedEvent(event) || (target && target !== "_self")) return;
    const url = new URL(to, window.location.origin);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(to, { replace, state });
  };
  return (
    <a href={to} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

/** Declarative redirect. */
export function Navigate({ to, replace = true, state }: { to: string; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, to, replace, state]);
  return null;
}

/** Scrolls to top on route change, or to the hash target when there is one. */
export function useScrollManagement() {
  const { pathname, hash, key } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      // Wait a frame so lazily rendered sections exist.
      const frame = requestAnimationFrame(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
          return;
        }
        window.scrollTo(0, 0);
      });
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash, key]);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
