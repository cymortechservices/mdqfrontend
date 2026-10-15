import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "../../lib/router";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

interface CommonProps {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  className?: string;
  children?: ReactNode;
}

export function buttonClasses({ variant = "primary", size = "md", block, loading, className }: CommonProps): string {
  return [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    block ? "btn--block" : "",
    loading ? "is-loading" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function Inner({ loading, iconLeft, iconRight, children }: CommonProps) {
  return (
    <>
      {loading ? <span className="spinner spinner--sm" aria-hidden="true" /> : iconLeft ? <Icon name={iconLeft} size={18} /> : null}
      <span className="btn__label">{children}</span>
      {!loading && iconRight ? <Icon name={iconRight} size={18} /> : null}
    </>
  );
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({ variant, size, block, loading, iconLeft, iconRight, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, loading, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inner loading={loading} iconLeft={iconLeft} iconRight={iconRight}>
        {children}
      </Inner>
    </button>
  );
}

interface ButtonLinkProps extends CommonProps {
  to: string;
  onClick?: () => void;
  target?: string;
  rel?: string;
  "aria-label"?: string;
}

/** Router link styled as a button. Use `external` for mailto:, tel:, https:// targets. */
export function ButtonLink({ to, variant, size, block, iconLeft, iconRight, className, children, ...rest }: ButtonLinkProps) {
  const classes = buttonClasses({ variant, size, block, className });
  const external = /^(https?:|mailto:|tel:)/.test(to);
  const content = (
    <Inner iconLeft={iconLeft} iconRight={iconRight}>
      {children}
    </Inner>
  );
  if (external) {
    return (
      <a href={to} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link to={to} className={classes} {...rest}>
      {content}
    </Link>
  );
}
