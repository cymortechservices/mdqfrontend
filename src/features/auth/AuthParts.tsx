import type { ReactNode } from "react";
import { Icon, type IconName } from "../../components/ui/Icon";

export function AuthCard({
  icon,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  icon?: IconName;
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-card">
      <header className="auth-card__head">
        {icon ? (
          <span className="auth-card__icon">
            <Icon name={icon} size={24} />
          </span>
        ) : null}
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="h2">{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </header>
      {children}
      {footer ? <footer className="auth-card__foot">{footer}</footer> : null}
    </div>
  );
}
