import { useState, type ReactNode } from "react";
import { Logo } from "../components/brand/Logo";
import { Badge } from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { useAuth } from "../features/auth/AuthContext";
import { SkipLink } from "./PublicLayout";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <div className="admin-shell">
      <SkipLink />
      <header className="admin-bar">
        <div className="admin-bar__inner">
          <div className="admin-bar__brand">
            <Logo compact to="/portal" />
            <Badge tone="gold" icon="shieldCheck">
              Administration
            </Badge>
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconLeft="logOut"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await logout();
            }}
          >
            Log out
          </Button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="admin-main">
        {children}
      </main>
    </div>
  );
}
