import { Link } from "../../lib/router";

interface LogoProps {
  /** Where the logo links to. Pass null for a non-interactive logo. */
  to?: string | null;
  /** Hide the “by Karimique” line. */
  compact?: boolean;
  /** Visually hide the wordmark text (sidebar collapsed state). */
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Official Karimique emblem (cropped from the supplied logo, proportions preserved) + MDQ wordmark. */
export function Logo({ to = "/", compact = false, iconOnly = false, size = "md", className = "" }: LogoProps) {
  const inner = (
    <>
      <img
        className="logo__mark"
        src="/images/karimique_mark.webp"
        alt="Karimique logo"
        width="256"
        height="256"
        decoding="async"
      />
      {!iconOnly ? (
        <span className="logo__text">
          <span className="logo__word">MDQ</span>
          {!compact ? <span className="logo__by">by Karimique</span> : null}
        </span>
      ) : null}
    </>
  );
  const classes = `logo logo--${size} ${className}`.trim();
  if (to === null) return <span className={classes}>{inner}</span>;
  return (
    <Link to={to} className={classes} aria-label="MDQ by Karimique — home">
      {inner}
    </Link>
  );
}
