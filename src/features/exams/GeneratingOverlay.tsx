import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "../../components/ui/Icon";
import { ASSESSMENTS, type TestType } from "../../lib/config";
import { formatClock } from "../../lib/exam";
import type { StreamProgress } from "./assessmentStream";

interface Phase {
  icon: IconName;
  title: string;
  text: string;
}

/** Phases follow what has really arrived from the server, never the clock. */
function phasesFor(type: TestType): Phase[] {
  const written = type === "exam";
  return [
    { icon: "fileText", title: "Reading your request", text: "Matching your year, subject and topic." },
    {
      icon: "listChecks",
      title: written ? "Setting your MCQs, SAQs and essay" : "Setting your MCQs",
      text: "Your exam opens with the first questions; the rest follow.",
    },
    { icon: "sparkles", title: "Final touches", text: "Opening your answer sheet." },
  ];
}

const TIPS: { title: string; text: string }[] = [
  { title: "Answer from memory first", text: "Retrieval beats re-reading. Commit to an answer before you second-guess it." },
  { title: "Read the stem before the options", text: "Try to name the diagnosis or concept before you look at the choices." },
  { title: "Flag, don't freeze", text: "If a question stalls you for over a minute, flag it and come back." },
  { title: "Eliminate, then decide", text: "Cross out options you can disprove; the best of the rest is usually clearer." },
  { title: "Explanations are the lesson", text: "After you submit, read why each answer is right, not only your score." },
  { title: "Written answers: structure wins", text: "For SAQs and essays, use headings and short points so a marker can award marks quickly." },
  { title: "Watch the clock, not the page count", text: "Check the timer at the start of each section and pace to it." },
  { title: "Repeat your weak topic", text: "Set a fresh test on the topic you scored lowest in while it is still fresh." },
  { title: "Rest your eyes", text: "Look at something far away for twenty seconds while you wait." },
];

function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * Full-screen waiting experience while an assessment is being set up. It has no timer promise:
 * progress is the number of questions the server has streamed so far, and the bar only reads as a
 * percentage when the server announced how many to expect. It never shows 100 % until the exam is ready.
 */
export function GeneratingOverlay({ testType, subject, year, progress }: { testType: TestType; subject: string; year: string; progress: StreamProgress }) {
  const elapsed = useNow();
  const phases = useMemo(() => phasesFor(testType), [testType]);
  const heading = useRef<HTMLHeadingElement>(null);

  const [tip, setTip] = useState(0);
  const [paused, setPaused] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [breathStep, setBreathStep] = useState<"in" | "hold" | "out">("in");

  useEffect(() => heading.current?.focus(), []);

  // Block accidental reloads while the request is in flight.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), 9000);
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (!breathing) return undefined;
    const order: ("in" | "hold" | "out")[] = ["in", "hold", "out"];
    let i = 0;
    setBreathStep("in");
    const id = window.setInterval(() => {
      i = (i + 1) % order.length;
      setBreathStep(order[i]!);
    }, 4000);
    return () => window.clearInterval(id);
  }, [breathing]);

  const { received, expected } = progress;
  const known = expected !== null && expected > 0;
  const percent = known ? Math.min(99, Math.floor((received / expected!) * 100)) : null;
  const phaseIndex = received === 0 ? 0 : known && received >= expected! ? 2 : 1;
  const label = ASSESSMENTS[testType].label;
  const currentTip = TIPS[tip]!;

  return createPortal(
    <div className="gen" role="dialog" aria-modal="true" aria-labelledby="gen-title" aria-describedby="gen-desc">
      <div className="gen__bg" aria-hidden="true">
        <span className="gen__orb gen__orb--a" />
        <span className="gen__orb gen__orb--b" />
        <span className="gen__orb gen__orb--c" />
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} className="gen__spark" style={{ ["--i" as string]: i }} />
        ))}
      </div>

      <div className="gen__panel">
        <div className="gen__core" aria-hidden="true">
          <svg viewBox="0 0 120 120" className="gen__ring">
            <circle cx="60" cy="60" r="52" className="gen__ring-bg" />
            <circle cx="60" cy="60" r="52" className={`gen__ring-fg ${known ? "" : "is-indeterminate"}`} pathLength={100} style={{ ["--p" as string]: percent ?? 28 }} />
          </svg>
          <svg viewBox="0 0 120 120" className="gen__orbit">
            <circle cx="60" cy="8" r="4" />
          </svg>
          <div className="gen__pulse">
            <svg viewBox="0 0 120 40" className="gen__ecg">
              <path d="M0 20 H30 L38 6 L48 34 L56 12 L62 20 H120" />
            </svg>
            <strong>{percent !== null ? `${percent}%` : received}</strong>
            {percent === null ? <small>{received === 1 ? "question" : "questions"}</small> : null}
          </div>
        </div>

        <p className="eyebrow gen__eyebrow">{label} in progress</p>
        <h2 id="gen-title" className="gen__title" tabIndex={-1} ref={heading}>
          Setting your {testType === "cat" ? "CAT" : "full exam"}
        </h2>
        <p id="gen-desc" className="gen__desc">
          {subject ? `${subject}${year ? ` · Year ${year}` : ""}. ` : ""}
          {received > 0 ? `${received} question${received === 1 ? "" : "s"} ready so far. ` : "Getting started. "}
          Please keep this page open.
        </p>

        <div
          className={`gen__bar ${known ? "" : "is-indeterminate"}`}
          role="progressbar"
          aria-label="Setting up your assessment"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          aria-valuetext={percent === null ? `${received} questions ready` : `${percent}%`}
        >
          <span style={known ? { width: `${percent}%` } : undefined} />
        </div>
        <div className="gen__times">
          <span>Elapsed {formatClock(elapsed, false)}</span>
          <span>{received} ready</span>
        </div>
        <p className="gen__estimate">Your exam opens as soon as the first questions arrive. The rest keep arriving while you answer.</p>

        <ol className="gen__phases" aria-label="What is happening">
          {phases.map((phase, i) => {
            const state = i < phaseIndex ? "done" : i === phaseIndex ? "current" : "todo";
            return (
              <li key={phase.title} className={`gen__phase is-${state}`} aria-current={state === "current" ? "step" : undefined}>
                <span className="gen__phase-icon">
                  <Icon name={state === "done" ? "check" : phase.icon} size={16} />
                </span>
                <span className="gen__phase-body">
                  <strong>{phase.title}</strong>
                  {state === "current" ? <span>{phase.text}</span> : null}
                </span>
                <span className="sr-only">{state === "done" ? "done" : state === "current" ? "in progress" : "waiting"}</span>
              </li>
            );
          })}
        </ol>

        <div className="gen__extras">
          <section
            className="gen__tip"
            aria-label="Study tips while you wait"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <p className="gen__tip-kicker">
              <Icon name="lightbulb" size={14} /> While you wait · tip {tip + 1} of {TIPS.length}
            </p>
            <div key={tip} className="gen__tip-body">
              <strong>{currentTip.title}</strong>
              <p>{currentTip.text}</p>
            </div>
            <div className="gen__tip-nav">
              <button type="button" className="icon-btn icon-btn--sm" aria-label="Previous tip" onClick={() => setTip((t) => (t - 1 + TIPS.length) % TIPS.length)}>
                <Icon name="arrowLeft" size={16} />
              </button>
              <span className="gen__dots" aria-hidden="true">
                {TIPS.map((_, i) => (
                  <i key={i} className={i === tip ? "is-on" : ""} />
                ))}
              </span>
              <button type="button" className="icon-btn icon-btn--sm" aria-label="Next tip" onClick={() => setTip((t) => (t + 1) % TIPS.length)}>
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
          </section>

          <section className="gen__breathe" aria-label="Breathing pacer">
            <button type="button" className={`gen__breathe-btn ${breathing ? "is-on" : ""}`} aria-pressed={breathing} onClick={() => setBreathing((b) => !b)}>
              <span className={`gen__bubble is-${breathStep}`} aria-hidden="true" />
              <span>{breathing ? (breathStep === "in" ? "Breathe in…" : breathStep === "hold" ? "Hold…" : "Breathe out…") : "Take a calm minute"}</span>
            </button>
            <p>{breathing ? "Tap to stop the pacer." : "Tap for a slow breathing pacer."}</p>
          </section>
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {phases[phaseIndex]?.title}{received > 0 ? `, ${received} questions ready` : ""}
        </div>
      </div>
    </div>,
    document.body,
  );
}
