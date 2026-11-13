/** Static, on-brand heart used when WebGL is unavailable or the context is lost. */
export function HeartFallback({ className = "" }: { className?: string }) {
  return (
    <svg className={`heart-fallback ${className}`} viewBox="0 0 200 220" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="hf-body" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="hsl(152,60%,38%)" />
          <stop offset="0.55" stopColor="hsl(150,70%,16%)" />
          <stop offset="1" stopColor="hsl(159,100%,6%)" />
        </radialGradient>
        <filter id="hf-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <path d="M100 196C56 160 22 124 22 84 22 56 42 40 64 40c16 0 28 9 36 22 8-13 20-22 36-22 22 0 42 16 42 44 0 40-34 76-78 112Z" fill="hsl(152,70%,52%)" opacity="0.35" filter="url(#hf-glow)" />
      <path d="M100 196C56 160 22 124 22 84 22 56 42 40 64 40c16 0 28 9 36 22 8-13 20-22 36-22 22 0 42 16 42 44 0 40-34 76-78 112Z" fill="url(#hf-body)" stroke="hsl(152,70%,52%)" strokeOpacity="0.7" strokeWidth="1.5" />
      <path d="M86 44c0-18 6-30 16-34 10 4 16 16 16 34" fill="none" stroke="hsl(160,75%,62%)" strokeOpacity="0.8" strokeWidth="7" strokeLinecap="round" />
      <path d="M40 92c26 6 52-4 70-22M70 150c10-26 24-50 44-64" fill="none" stroke="hsl(160,75%,62%)" strokeOpacity="0.35" strokeWidth="2" />
    </svg>
  );
}
