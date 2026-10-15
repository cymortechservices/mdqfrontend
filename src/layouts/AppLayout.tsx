import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "../components/brand/Logo";
import { Icon, type IconName } from "../components/ui/Icon";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { useAuth } from "../features/auth/AuthContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Link, useLocation } from "../lib/router";
import { KEYS, safeGet, safeSet } from "../lib/storage";
import { displayNameFor, initialsFor } from "../lib/format";
import { SkipLink } from "./PublicLayout";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

/** Same destinations as the original sidebar. */
const PRIMARY: NavItem[] = [
  { to: "/portal", label: "Overview", icon: "home" },
  { to: "/examroom", label: "Exam Room", icon: "graduationCap" },
  { to: "/performance", label: "Performance", icon: "chartLine" },
  { to: "/leaderboard", label: "Leaderboard", icon: "trophy" },
];
const SECONDARY: NavItem[] = [{ to: "/profile", label: "Profile", icon: "userRound" }];

function NavLinkItem({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  return (
    <Link
      to={item.to}
      className={`side-link ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
    >
      <Icon name={item.icon} size={20} />
      <span className="side-link__label">{item.label}</span>
    </Link>
  );
}

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [collapsed, setCollapsed] = useState(() => safeGet(KEYS.sidebar) === "collapsed");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    document.documentElement.classList.add("has-modal");
    sidebarRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key === "Tab" && sidebarRef.current) {
        const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("has-modal");
    };
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    safeSet(KEYS.sidebar, next ? "collapsed" : "expanded");
  };

  const isCollapsed = collapsed && !isMobile;
  const name = displayNameFor(user);

  const doLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className={`app-shell ${isCollapsed ? "is-collapsed" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
      <SkipLink />
      <aside
        ref={sidebarRef}
        id="app-sidebar"
        className="sidebar"
        aria-label="Primary navigation"
        // When the drawer is closed on mobile the sidebar is off-screen; keep it out of the tab order.
        {...(isMobile && !drawerOpen ? { inert: true } : {})}
      >
        <div className="sidebar__top">
          <Logo iconOnly={isCollapsed} compact to="/portal" />
          {isMobile ? (
            <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close navigation">
              <Icon name="x" size={20} />
            </button>
          ) : null}
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {PRIMARY.map((item) => (
            <NavLinkItem key={item.to} item={item} collapsed={isCollapsed} active={pathname === item.to} />
          ))}
        </nav>

        <div className="sidebar__bottom">
          {SECONDARY.map((item) => (
            <NavLinkItem key={item.to} item={item} collapsed={isCollapsed} active={pathname === item.to} />
          ))}
          <button type="button" className="side-link side-link--button" onClick={() => setConfirmLogout(true)} title={isCollapsed ? "Log out" : undefined}>
            <Icon name="logOut" size={20} />
            <span className="side-link__label">Log out</span>
          </button>
          {!isMobile ? (
            <button
              type="button"
              className="side-link side-link--button side-link--collapse"
              onClick={toggleCollapsed}
              aria-pressed={collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : undefined}
            >
              <Icon name="panelLeft" size={20} />
              <span className="side-link__label">{collapsed ? "Expand" : "Collapse"}</span>
            </button>
          ) : null}
        </div>
      </aside>

      <button type="button" className="drawer-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={() => setDrawerOpen(false)} />

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left">
            {isMobile ? (
              <button
                ref={toggleRef}
                type="button"
                className="icon-btn"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                aria-controls="app-sidebar"
              >
                <Icon name="menu" size={22} />
              </button>
            ) : null}
            <div className="topbar__crumbs">
              <span className="topbar__section">MDQ</span>
              <Icon name="chevronRight" size={14} />
              <h1 className="topbar__title">{title}</h1>
            </div>
          </div>
          <Link to="/profile" className="user-chip" aria-label={`Your profile, signed in as ${name}`}>
            <span className="user-chip__avatar" aria-hidden="true">
              {initialsFor(user)}
            </span>
            <span className="user-chip__text">
              <strong>{name}</strong>
              <span>{user?.studentEmail}</span>
            </span>
          </Link>
        </header>
        <main id="main-content" tabIndex={-1} className="app-content">
          {children}
        </main>
      </div>

      <Dialog
        open={confirmLogout}
        onClose={() => (loggingOut ? undefined : setConfirmLogout(false))}
        title="Log out of MDQ?"
        description="You will need to sign in again to continue practising."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmLogout(false)} disabled={loggingOut}>
              Stay signed in
            </Button>
            <Button variant="danger" onClick={() => void doLogout()} loading={loggingOut} iconLeft="logOut">
              Log out
            </Button>
          </>
        }
      />
    </div>
  );
}
