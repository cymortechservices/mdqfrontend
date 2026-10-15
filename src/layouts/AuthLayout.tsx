import type { ReactNode } from "react";
import { Logo } from "../components/brand/Logo";
import { Icon } from "../components/ui/Icon";
import { Link } from "../lib/router";
import { SkipLink } from "./PublicLayout";

/** Split layout: brand panel on wide screens, form first on mobile. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <SkipLink />
      <aside className="auth-aside" aria-label="About MDQ">
        <div className="auth-aside__inner">
          <Logo size="lg" />
          <div className="auth-aside__copy">
            <p className="eyebrow">Medical exam practice</p>
            <h2>Walk into your exams knowing where you stand.</h2>
            <ul className="auth-points">
              <li>
                <Icon name="listChecks" size={20} />
                <span>CATs and timed full exams built for Kenyan MBChB students.</span>
              </li>
              <li>
                <Icon name="chartLine" size={20} />
                <span>Scores, feedback and history for every attempt.</span>
              </li>
              <li>
                <Icon name="shieldCheck" size={20} />
                <span>Student-email sign-up. One free CAT and one free full exam after verification.</span>
              </li>
            </ul>
          </div>
          <p className="auth-aside__foot">© 2026 Karimique Labs</p>
        </div>
        <div className="auth-aside__glow" aria-hidden="true" />
      </aside>
      <div className="auth-main">
        <div className="auth-main__top">
          <Link to="/" className="back-link">
            <Icon name="arrowLeft" size={16} /> Back to home
          </Link>
        </div>
        <main id="main-content" tabIndex={-1} className="auth-card-wrap">
          {children}
        </main>
        <footer className="auth-main__foot">
          <Link to="/terms">Terms</Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacy-policy">Privacy</Link>
        </footer>
      </div>
    </div>
  );
}
