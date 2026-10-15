import { useState } from "react";
import { Button, ButtonLink } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { useAuth } from "../features/auth/AuthContext";
import { displayNameFor, formatDate, initialsFor } from "../lib/format";
import { Link } from "../lib/router";
import { usePageMeta } from "../lib/meta";
import { SITE } from "../lib/config";

export default function ProfilePage() {
  usePageMeta({ title: "Profile | MDQ", path: "/profile" });
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const rows = [
    { icon: "mail", label: "Student email", value: user?.studentEmail || "—" },
    { icon: "smartphone", label: "WhatsApp number", value: user?.whatsAppNumber || "—" },
    { icon: "calendar", label: "Member since", value: formatDate(user?.createdAt, "—") },
  ] as const;

  return (
    <div className="profile">
      <section className="card card--pad profile__card" aria-labelledby="profile-title">
        <div className="profile__head">
          <span className="avatar avatar--lg" aria-hidden="true">
            {initialsFor(user)}
          </span>
          <div>
            <p className="eyebrow">Account</p>
            <h2 id="profile-title" className="h2">
              {displayNameFor(user)}
            </h2>
          </div>
        </div>

        <dl className="profile__list">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>
                <Icon name={row.icon} size={16} /> {row.label}
              </dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="profile__actions">
          <ButtonLink to="/performance" variant="secondary" iconLeft="chartLine">
            View performance
          </ButtonLink>
          <Button
            variant="danger"
            iconLeft="logOut"
            loading={busy}
            onClick={() => {
              setBusy(true);
              void logout();
            }}
          >
            Log out
          </Button>
        </div>
      </section>

      <p className="muted profile__help">
        Need to change your details or lose access? Use <Link to="/forgot-password">password reset</Link> or contact{" "}
        <a href={SITE.whatsappUrl} target="_blank" rel="noopener noreferrer">
          MDQ support on WhatsApp
        </a>
        .
      </p>
    </div>
  );
}
