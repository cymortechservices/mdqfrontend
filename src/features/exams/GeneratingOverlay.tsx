import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "../../components/ui/Icon";
import { ASSESSMENTS, type TestType } from "../../lib/config";
import { formatClock } from "../../lib/exam";

/** Typical generation time, as told by the product owner: CAT ≈ 4 minutes, full exam ≈ 8 minutes. */
export const EXPECTED_GENERATION_SECONDS: Record<TestType, number> = { cat: 4 * 60, exam: 8 * 60 };

interface Phase {
  icon: IconName;
  title: string;
  text: string;
  /** Fraction of the expected time at which this phase starts. */
  from: number;
}

function phasesFor(type: TestType): Phase[] {
  const written = type === "exam";
  return [
    { icon: "fileText", title: "Reading your request", text: "Matching your year, subject and topic.", from: 0 },
    { icon: "bookOpen", title: "Searching the textbooks", text: "Finding the passages your questions will be built from.", from: 0.1 },
    {
      icon: "listChecks",
      title: written ? "Writing MCQs, SAQs and the essay" : "Drafting 50 MCQs",
      text: written ? "Building each section of your full exam." : "Writing one-best-answer questions with plausible options.",
      from: 0.28,
    },
    { icon: "shield", title: "Checking answers against sources", text: "Every answer is checked against the source passages.", from: 0.68 },
    { icon: "sparkles", title: "Final polish", text: "Setting up your timer and answer sheet.", from: 0.9 },
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
  { title: "Repeat your weak topic", text: "Generate a fresh test on the topic you scored lowest in while it is still fresh." },
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
 * Full-screen waiting experience for assessment generation. The percentage is an estimate based
 * on typical generation time — it never reaches 100 % until the server actually answers, and the
 * copy says so. Nothing here changes what is requested or submitted.
 */
export function GeneratingOverlay({ testType, subject, year }: { testType: TestType; subject: string; year: string }) {
  const elapsed = useNow();
  const expected = EXPECTED_GENERATION_SECONDS[testType];
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

  const ratio = elapsed / expected;
  const overtime = ratio >= 1;
  // Smoothly approach 95 % at the expected time, then creep towards 99 % — never 100 %.
  const percent = overtime ? Math.min(99, 95 + (1 - Math.exp(-(elapsed - expected) / 240)) * 4) : Math.min(95, ratio * 95);
  const phaseIndex = phases.reduce((acc, phase, i) => (ratio >= phase.from ? i : acc), 0);
  const remaining = Math.max(0, expected - elapsed);
  const minutesLeft = Math.max(1, Math.ceil(remaining / 60));
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
            <circle cx="60" cy="60" r="52" className="gen__ring-fg" pathLength={100} style={{ ["--p" as string]: percent }} />
          </svg>
          <svg viewBox="0 0 120 120" className="gen__orbit">
            <circle cx="60" cy="8" r="4" />
          </svg>
          <div className="gen__pulse">
            <svg viewBox="0 0 120 40" className="gen__ecg">
              <path d="M0 20 H30 L38 6 L48 34 L56 12 L62 20 H120" />
            </svg>
            <strong>{Math.floor(percent)}%</strong>
          </div>
        </div>

        <p className="eyebrow gen__eyebrow">{label} in progress</p>
        <h2 id="gen-title" className="gen__title" tabIndex={-1} ref={heading}>
          Building your {testType === "cat" ? "CAT" : "full exam"}
        </h2>
        <p id="gen-desc" className="gen__desc">
          {subject ? `${subject}${year ? ` · Year ${year}` : ""}. ` : ""}
          {overtime
            ? "Taking a little longer than usual. We are still working, so please keep this page open."
            : `This usually takes about ${testType === "cat" ? "4" : "8"} minutes. Please keep this page open.`}
        </p>

        <div className="gen__bar" role="progressbar" aria-label="Estimated progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(percent)}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="gen__times">
          <span>Elapsed {formatClock(elapsed, false)}</span>
          <span>{overtime ? "Finishing up" : `About ${minutesLeft} min left`}</span>
        </div>
        <p className="gen__estimate">Progress is an estimate based on typical generation time. It reaches 100% only when your assessment is ready.</p>

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
          {phases[phaseIndex]?.title}
        </div>
      </div>
    </div>,
    document.body,
  );
}
