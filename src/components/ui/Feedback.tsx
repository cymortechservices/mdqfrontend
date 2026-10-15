import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function Spinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  return <span className={`spinner spinner--${size}`} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

type AlertTone = "info" | "success" | "error" | "warning";

/** Inline status message. Errors use role="alert"; everything else role="status". */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const icon: IconName = tone === "success" ? "checkCircle" : tone === "error" ? "alertCircle" : tone === "warning" ? "alertTriangle" : "info";
  return (
    <div className={`alert alert--${tone} ${className}`.trim()} role={tone === "error" ? "alert" : "status"}>
      <Icon name={icon} size={20} className="alert__icon" />
      <div className="alert__body">
        {title ? <strong className="alert__title">{title}</strong> : null}
        {children ? <div className="alert__text">{children}</div> : null}
        {action ? <div className="alert__action">{action}</div> : null}
      </div>
    </div>
  );
}

export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "gold" | "accent";
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

export function EmptyState({
  icon = "fileText",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="empty__title">{title}</h3>
      {children ? <p className="empty__text">{children}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}

/** Horizontal meter with a text value, so colour is never the only signal. */
export function Meter({ value, label, tone = "accent" }: { value: number; label: string; tone?: "accent" | "warning" | "danger" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`meter meter--${tone}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <span className="meter__fill" style={{ ["--w" as string]: `${clamped}%` }} />
    </div>
  );
}

export function Accordion({ items }: { items: { id: string; question: string; answer: ReactNode }[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const base = useId();
  return (
    <div className="accordion">
      {items.map((item) => {
        const open = openId === item.id;
        const buttonId = `${base}-${item.id}-btn`;
        const panelId = `${base}-${item.id}-panel`;
        return (
          <div key={item.id} className={`accordion__item ${open ? "is-open" : ""}`}>
            <h3 className="accordion__heading">
              <button
                type="button"
                id={buttonId}
                className="accordion__trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <span>{item.question}</span>
                <Icon name="plus" size={20} className="accordion__icon" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} className="accordion__panel" hidden={!open}>
              <div className="accordion__content">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
