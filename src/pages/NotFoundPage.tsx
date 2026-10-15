import { ButtonLink } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { usePageMeta } from "../lib/meta";

export default function NotFoundPage() {
  usePageMeta({ title: "Page not found | MDQ", robots: "noindex, nofollow" });
  return (
    <section className="notfound">
      <span className="notfound__icon" aria-hidden="true">
        <Icon name="heartPulse" size={40} />
      </span>
      <p className="eyebrow">Error 404</p>
      <h1 className="h1">We couldn’t find that page</h1>
      <p className="muted">The link may be old or mistyped. Head back home or jump into your studies.</p>
      <div className="notfound__actions">
        <ButtonLink to="/" iconLeft="home">
          Go to home
        </ButtonLink>
        <ButtonLink to="/portal" variant="secondary">
          Open my dashboard
        </ButtonLink>
      </div>
    </section>
  );
}
