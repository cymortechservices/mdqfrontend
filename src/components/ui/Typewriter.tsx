import { Fragment, useEffect, useState } from "react";
import { useReducedMotion } from "../../lib/motion";

/** True once the cinematic intro has released the hero (html no longer carries `hero-hold`). */
function useHeroReleased(): boolean {
  const read = () => typeof document === "undefined" || !document.documentElement.classList.contains("hero-hold");
  const [released, setReleased] = useState(read);
  useEffect(() => {
    if (released) return undefined;
    const observer = new MutationObserver(() => {
      if (read()) {
        setReleased(true);
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [released]);
  return released;
}

export interface TypewriterSegment {
  text: string;
  className?: string;
}

/**
 * Types the given segments one after another with a blinking caret.
 *
 * Layout never jumps and the full sentence is always in the DOM: characters that haven't been typed yet are
 * rendered with `opacity: 0` in the same flow, so line-wrapping is final from the first frame and screen
 * readers read the complete text. Starts when the intro releases the hero. Reduced motion: full text, no caret.
 */
export function Typewriter({ segments, speed = 46, startDelay = 650 }: { segments: TypewriterSegment[]; speed?: number; startDelay?: number }) {
  const reduced = useReducedMotion();
  const released = useHeroReleased();
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  const [typed, setTyped] = useState(0);
  const [caret, setCaret] = useState(true);

  useEffect(() => {
    if (reduced) {
      setTyped(total);
      setCaret(false);
      return undefined;
    }
    if (!released) return undefined;
    let n = 0;
    let timer = window.setTimeout(function tick() {
      n += 1;
      setTyped(n);
      if (n < total) {
        // a touch of human irregularity: slower after punctuation and spaces
        const ch = segments.flatMap((s) => [...s.text])[n - 1] ?? "";
        timer = window.setTimeout(tick, speed * (ch === "." ? 5 : ch === " " ? 1.6 : 0.7 + Math.random() * 0.7));
      }
    }, startDelay);
    return () => window.clearTimeout(timer);
  }, [released, reduced, total, speed, startDelay]); // eslint-disable-line react-hooks/exhaustive-deps

  let consumed = 0;
  return (
    <>
      {segments.map((segment, i) => {
        const chars = [...segment.text];
        const done = Math.max(0, Math.min(chars.length, typed - consumed));
        const active = caret && typed >= consumed && typed < consumed + chars.length + (i === segments.length - 1 ? 1 : 0) && (typed > 0 || i === 0);
        consumed += chars.length;
        return (
          <Fragment key={i}>
            <span className={`tw ${segment.className ?? ""}`.trim()}>
              {chars.slice(0, done).join("")}
              <span className="tw__rest">{chars.slice(done).join("")}</span>
            </span>
            {/* caret lives OUTSIDE the (gradient-clipped) text span so it is always visible, right after the last typed character */}
            {active ? <span className="tw__caret" aria-hidden="true" /> : null}
          </Fragment>
        );
      })}
    </>
  );
}
