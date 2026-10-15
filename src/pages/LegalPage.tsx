import type { ReactNode } from "react";
import { Link } from "../lib/router";
import { Icon } from "../components/ui/Icon";
import { usePageMeta } from "../lib/meta";

interface LegalPageProps {
  title: string;
  updated: string;
  path: string;
  sections: [id: string, label: string][];
  children: ReactNode;
}

/** Shared frame for the privacy policy and terms: readable measure, contents list, cross-links. */
export function LegalPage({ title, updated, path, sections, children }: LegalPageProps) {
  usePageMeta({ title: `${title} | MDQ`, path, robots: "index, follow", description: `${title} for MDQ by Karimique Labs.` });
  const other = path === "/terms" ? { to: "/privacy-policy", label: "Privacy Policy" } : { to: "/terms", label: "Terms of Service" };
  return (
    <div className="legal">
      <header className="legal__head">
        <p className="eyebrow">Legal</p>
        <h1 className="h1">{title}</h1>
        <p className="muted">Last updated: {updated}</p>
      </header>
      <div className="legal__layout">
        <nav className="legal__toc" aria-label={`${title} contents`}>
          <p className="legal__toc-title">On this page</p>
          <ol>
            {sections.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
          <Link to={other.to} className="legal__other">
            {other.label} <Icon name="arrowRight" size={14} />
          </Link>
        </nav>
        <article className="legal__content" aria-label={`${title} content`}>
          {children}
        </article>
      </div>
    </div>
  );
}
