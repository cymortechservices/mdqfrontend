import { useEffect, useId, useRef, useState } from "react";
import { useInView } from "../../lib/motion";

export interface TrendPoint {
  /** Short x-axis label, e.g. "12 Oct". */
  label: string;
  /** Percentage 0–100. */
  value: number;
  /** Tooltip heading, e.g. the assessment title. */
  title: string;
  /** Tooltip detail, e.g. "CAT · Anatomy · 38/50". */
  detail: string;
}

const HEIGHT = 260;
const M = { top: 14, right: 18, bottom: 34, left: 42 };

/**
 * Score-over-time line chart (SVG, no dependency). Hover or focus a point for details; a
 * visually hidden table repeats the data for assistive technology. The 70 % line is the same
 * threshold the performance insights use to call a result a "strength".
 */
export function TrendChart({ points, summary }: { points: TrendPoint[]; summary: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [ref, seen] = useInView<HTMLDivElement>();
  const gradId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setWidth(Math.max(280, el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const x = (i: number) => M.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length > 1 ? `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : "";

  // Thin x labels so they never overlap.
  const maxLabels = Math.max(2, Math.floor(innerW / 80));
  const step = Math.ceil(points.length / maxLabels);

  const tip = active !== null ? points[active] : null;
  const tipLeft = tip ? Math.min(Math.max(x(active!) - 90, 4), width - 184) : 0;

  return (
    <figure className="chart" ref={wrapRef} aria-label={summary}>
      <div ref={ref} className={`chart__svg-wrap ${seen ? "is-in" : ""}`}>
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={summary}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line x1={M.left} x2={width - M.right} y1={y(tick)} y2={y(tick)} className="chart__grid" />
              <text x={M.left - 8} y={y(tick) + 4} textAnchor="end" className="chart__tick">
                {tick}%
              </text>
            </g>
          ))}
          <line x1={M.left} x2={width - M.right} y1={y(70)} y2={y(70)} className="chart__ref" />
          <text x={width - M.right} y={y(70) - 6} textAnchor="end" className="chart__ref-label">
            70% strength mark
          </text>
          {area ? <path d={area} fill={`url(#${gradId})`} className="chart__area" /> : null}
          {points.length > 1 ? <path d={line} className="chart__line" pathLength={1} /> : null}
          {points.map((p, i) => (
            <g key={`${p.label}-${i}`}>
              {i % step === 0 || i === points.length - 1 ? (
                <text x={x(i)} y={HEIGHT - 10} textAnchor="middle" className="chart__tick">
                  {p.label}
                </text>
              ) : null}
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r={active === i ? 7 : 5}
                className="chart__dot"
                tabIndex={0}
                role="img"
                aria-label={`${p.title}, ${p.detail}, ${Math.round(p.value)}%`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          ))}
        </svg>
        {tip ? (
          <div className="chart__tip" style={{ left: tipLeft, top: Math.max(0, y(tip.value) - 78) }} role="status">
            <strong>{Math.round(tip.value)}%</strong>
            <span>{tip.title}</span>
            <span className="muted">{tip.detail}</span>
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th>Assessment</th>
            <th>Details</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.title}</td>
              <td>{p.detail}</td>
              <td>{Math.round(p.value)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Circular gauge with the value in text (colour is never the only signal). */
export function RingGauge({ value, size = 132, label, caption }: { value: number | null; size?: number; label: string; caption?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const radius = 15.5;
  const clamped = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div ref={ref} className={`ring ${seen ? "is-in" : ""}`} style={{ width: size, height: size }} role="img" aria-label={value == null ? `${label}: no data yet` : `${label}: ${Math.round(clamped)} percent`}>
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
        <circle cx="18" cy="18" r={radius} className="ring__bg" />
        <circle cx="18" cy="18" r={radius} className="ring__fg" pathLength={100} style={{ ["--v" as string]: clamped }} />
      </svg>
      <div className="ring__text">
        <strong>{value == null ? "--" : `${Math.round(clamped)}%`}</strong>
        {caption ? <span>{caption}</span> : null}
      </div>
    </div>
  );
}
