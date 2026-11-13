import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Logo } from "../../components/brand/Logo";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Alert, Badge, EmptyState } from "../../components/ui/Feedback";
import { Icon } from "../../components/ui/Icon";
import { TextField } from "../../components/ui/Field";
import { RingGauge } from "../../components/charts/TrendChart";
import { api, request } from "../../lib/api";
import {
  formatClock,
  formatDuration,
  instructionsFor,
  normalizeExam,
  optionLetter,
  type ViewExam,
  type ViewQuestion,
} from "../../lib/exam";
import { usePageMeta } from "../../lib/meta";
import { useNavigate } from "../../lib/router";
import {
  KEYS,
  pendingPaymentKey,
  readAnswerDraft,
  readCurrentExam,
  safeRemove,
  safeSet,
  saveAnswerDraft,
  saveCurrentExam,
  clearAnswerDraft,
} from "../../lib/storage";
import type { ExamPayload, ExamResult } from "../../types/api";
import { countQuestions, getLive, resetLive, useLive } from "./liveAssessment";

const getLiveStatus = () => getLive().status;

type Answers = Record<string, string>;

/**
 * Starts (or resumes) the clock: the first time the exam opens, `startedAt` is stored on currentExam.
 * With streaming, that is the moment the first questions appear. `interruptedOnLoad` is true when the page
 * was reloaded while questions were still arriving (the connection died with the old page).
 */
function useStoredExam(): { raw: ExamPayload | null; startedAt: number; interruptedOnLoad: boolean } {
  return useMemo(() => {
    const raw = readCurrentExam();
    if (!raw) return { raw: null, startedAt: Date.now(), interruptedOnLoad: false };
    const saved = Number(raw.startedAt);
    const startedAt = Number.isFinite(saved) && saved > 0 ? saved : Date.now();
    raw.startedAt = startedAt;
    // The marker is stored with the exam so every later mount of this page agrees the stream was cut short.
    if (raw.streaming === true && getLiveStatus() === "idle") {
      delete raw.streaming;
      raw.interrupted = true;
    }
    const interruptedOnLoad = raw.interrupted === true;
    saveCurrentExam(raw);
    return { raw, startedAt, interruptedOnLoad };
  }, []);
}

function useCountdown(deadline: number, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const fired = useRef(false);
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        expire.current();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, active]);
  return remaining;
}

export default function ExamInterfacePage() {
  usePageMeta({ title: "MDQ Exam Interface", path: "/examinterface" });
  const { raw, startedAt, interruptedOnLoad } = useStoredExam();
  const live = useLive();
  // While an assessment is arriving (or has just finished arriving) the live store is the source of truth.
  const source = live.status !== "idle" && live.exam ? live.exam : raw;
  const exam = useMemo(() => (source ? normalizeExam(source) : null), [source]);
  const stream: StreamInfo = {
    active: live.status === "streaming",
    expected: live.status !== "idle" ? live.expected : null,
    error: live.status === "error" ? live.error : null,
    interrupted: interruptedOnLoad,
  };

  if (!exam || !exam.questions.length) {
    return (
      <div className="fullscreen-center">
        <Logo to="/portal" />
        <EmptyState
          icon="fileText"
          title="No exam found"
          action={
            <ButtonLink to="/examroom" iconRight="arrowRight">
              Go to the Exam Room
            </ButtonLink>
          }
        >
          Go back to the exam room and set up a test first.
        </EmptyState>
      </div>
    );
  }
  const clock = Number(source?.startedAt) > 0 ? Number(source!.startedAt) : startedAt;
  return <ExamSession exam={exam} startedAt={clock} stream={stream} />;
}

/** What the exam page needs to know about questions that are still arriving. */
interface StreamInfo {
  active: boolean;
  /** Total announced by the server, when it announced one. */
  expected: number | null;
  /** The stream broke after the exam opened. */
  error: string | null;
  /** The page was reloaded mid-stream. */
  interrupted: boolean;
}

interface SubmitResult {
  result: ExamResult;
}

function ExamSession({ exam, startedAt, stream }: { exam: ViewExam; startedAt: number; stream: StreamInfo }) {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answers>(() => readAnswerDraft(exam.examId));
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [navOpen, setNavOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<SubmitResult | null>(null);
  const submittingRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [announce, setAnnounce] = useState("");

  const received = exam.questions.length;
  const arriving = stream.active;
  const incomplete = !arriving && (stream.error !== null || stream.interrupted);
  // The count shown to the student: what the server announced, once it announced something, else what has arrived.
  const total = arriving && stream.expected ? Math.max(stream.expected, received) : received;
  const pending = Math.max(0, total - received);
  const question = exam.questions[Math.min(index, received - 1)]!;
  const answeredCount = exam.questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  // Submitting is locked until every question has arrived AND has an answer. Only the timer running out submits regardless.
  const left = Math.max(0, total - answeredCount);
  const canSubmit = !arriving && received > 0 && answeredCount >= received;
  const lockHint = arriving
    ? "Submit unlocks once every question has arrived and been answered."
    : left > 0
      ? `Answer the remaining ${left} question${left === 1 ? "" : "s"} to unlock Submit.`
      : "Every question is answered. You can submit now.";
  const deadline = startedAt + exam.durationMinutes * 60 * 1000;

  // ----- questions arriving: tell screen readers, and show a short "all ready" note when the last one lands -----
  const lastReceived = useRef(received);
  const wasArriving = useRef(arriving);
  const [justFinished, setJustFinished] = useState(false);
  useEffect(() => {
    if (arriving && received > lastReceived.current) setAnnounce(`${received} questions ready`);
    lastReceived.current = received;
  }, [received, arriving]);
  useEffect(() => {
    if (wasArriving.current && !arriving && !stream.error) {
      setJustFinished(true);
      setAnnounce(`All ${received} questions are ready.`);
      const id = window.setTimeout(() => setJustFinished(false), 5000);
      wasArriving.current = arriving;
      return () => window.clearTimeout(id);
    }
    wasArriving.current = arriving;
    return undefined;
  }, [arriving, stream.error, received]);

  // ----- draft persistence (same keys as the original; scoped to this exam) -----
  useEffect(() => {
    if (!done) saveAnswerDraft(exam.examId, answers);
  }, [answers, exam.examId, done]);

  // ----- paid-exam delivery confirmation (POST /api/exams/:id/confirm-delivery) -----
  const [delivery, setDelivery] = useState<"idle" | "saving" | "error">(exam.requiresPaymentConfirmation && exam.examId ? "saving" : "idle");
  const confirmDelivery = useCallback(async () => {
    if (!exam.examId) return;
    setDelivery("saving");
    try {
      await api(`/api/exams/${encodeURIComponent(String(exam.examId))}/confirm-delivery`, { method: "POST" });
      safeRemove(pendingPaymentKey(exam.examType));
      setDelivery("idle");
    } catch (cause) {
      console.error("Could not confirm paid exam delivery:", cause);
      setDelivery("error");
    }
  }, [exam.examId, exam.examType]);
  const deliveryStarted = useRef(false);
  useEffect(() => {
    if (exam.requiresPaymentConfirmation && exam.examId && !deliveryStarted.current) {
      deliveryStarted.current = true;
      void confirmDelivery();
    }
  }, [exam.requiresPaymentConfirmation, exam.examId, confirmDelivery]);

  // ----- leaving the page mid-exam -----
  useEffect(() => {
    if (done) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [done]);

  // ----- name capture (428 + nameRequired) -----
  const nameResolver = useRef<((name: string) => void) | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const requestDisplayName = () =>
    new Promise<string>((resolve) => {
      setName("");
      setNameError("");
      nameResolver.current = resolve;
      setNameOpen(true);
    });
  const onNameSubmit = (event: FormEvent) => {
    event.preventDefault();
    const display = name.trim().replace(/\s+/g, " ");
    if (display.length < 2 || display.length > 120) {
      setNameError("Enter a name between 2 and 120 characters.");
      return;
    }
    setNameOpen(false);
    nameResolver.current?.(display);
    nameResolver.current = null;
  };

  // ----- submission (POST /api/submit-exam, identical payload to the original) -----
  // No error banner: a failed attempt is retried quietly (always, once time is up, since nothing else can be done).
  // Only a clear rejection from the server (HTTP 4xx other than 408/425/429) stops the retries.
  const submit = useCallback(
    async (timeUp = false) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setConfirmOpen(false);

      const payload: Answers = {};
      for (const q of exam.questions) {
        const value = answersRef.current[q.id] ?? "";
        payload[q.id] = q.type === "mcq" ? value : value.trim();
      }
      safeSet(KEYS.currentExamAnswers, JSON.stringify(payload));

      const maxAttempts = timeUp ? 60 : 4;
      try {
        let result: ExamResult | null = null;
        for (let attempt = 1; attempt <= maxAttempts && !result; attempt++) {
          try {
            const response = await request<ExamResult & { error?: string; nameRequired?: boolean }>("/api/submit-exam", {
              method: "POST",
              json: { examId: exam.examId, answers: payload },
            });
            if (response.status === 428 && response.data.nameRequired) {
              const displayName = await requestDisplayName();
              await api("/api/me/name", { method: "PUT", json: { displayName }, fallbackMessage: "Could not save your name." });
              attempt--; // saving the name is not a failed attempt
              continue;
            }
            if (response.ok) {
              result = response.data;
              break;
            }
            const retryable = response.status >= 500 || [408, 425, 429].includes(response.status);
            console.error("Submit rejected:", response.status, response.data.error);
            if (!retryable) break;
          } catch (cause) {
            console.error("Could not submit exam:", cause); // network error: try again
          }
          await new Promise((resolve) => window.setTimeout(resolve, Math.min(1000 * attempt, 5000)));
        }
        if (!result) {
          submittingRef.current = false;
          return;
        }
        safeSet(
          KEYS.currentExamResult,
          JSON.stringify({ exam: { ...exam }, answers: payload, result, completedAt: new Date().toISOString() }),
        );
        safeRemove(KEYS.currentExam);
        resetLive();
        clearAnswerDraft();
        setDone({ result });
        window.scrollTo(0, 0);
      } finally {
        setSubmitting(false);
      }
    },
    [exam],
  );

  // ----- timer (auto-submits at zero, as the original did) -----
  const remaining = useCountdown(deadline, !done, () => {
    setAnnounce("Time is up. Submitting your answers.");
    void submit(true);
  });
  useEffect(() => {
    if (remaining === 600 || remaining === 300 || remaining === 60) setAnnounce(`${remaining / 60} minute${remaining === 60 ? "" : "s"} remaining`);
  }, [remaining]);

  const setAnswer = (id: string, value: string) => setAnswers((current) => ({ ...current, [id]: value }));
  const toggleFlag = (id: string) =>
    setFlagged((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const go = (target: number) => {
    setIndex(Math.max(0, Math.min(received - 1, target)));
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };

  if (done) return <ResultScreen exam={exam} result={done.result} onNavigate={navigate} />;

  const timerClass = remaining <= 10 ? "is-danger" : ""; // flashes red only during the final 10 seconds
  const sectionOf = (q: ViewQuestion) => exam.sections.find((s) => s.questions.includes(q));
  const section = sectionOf(question);
  const posInSection = section ? section.questions.indexOf(question) + 1 : index + 1;
  const unanswered = total - answeredCount;

  const navigator = (
    <nav className="qnav" aria-label="Question navigator">
      {exam.sections.map((s) => (
        <div key={s.type} className="qnav__group">
          <p className="qnav__title">
            {s.title} <span>({s.questions.length})</span>
          </p>
          <div className="qnav__grid">
            {s.questions.map((q, i) => {
              const globalIndex = exam.questions.indexOf(q);
              const isAnswered = (answers[q.id] ?? "").trim() !== "";
              const isFlagged = flagged.has(q.id);
              const current = globalIndex === index;
              return (
                <button
                  key={q.id}
                  type="button"
                  className={`qbtn ${isAnswered ? "is-answered" : ""} ${isFlagged ? "is-flagged" : ""} ${current ? "is-current" : ""}`}
                  aria-current={current ? "step" : undefined}
                  aria-label={`${s.title.replace(/s$/, "")} ${i + 1}${isAnswered ? ", answered" : ", not answered"}${isFlagged ? ", flagged for review" : ""}`}
                  onClick={() => go(globalIndex)}
                >
                  {i + 1}
                  {isFlagged ? <Icon name="flag" size={10} className="qbtn__mark" /> : isAnswered ? <Icon name="check" size={10} className="qbtn__mark" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {pending > 0 ? (
        <div className="qnav__group" aria-live="polite">
          <p className="qnav__title">
            On the way <span>({pending})</span>
          </p>
          <div className="qnav__grid">
            {Array.from({ length: pending }, (_, i) => (
              <span key={i} className="qbtn qbtn--pending" aria-hidden="true">
                {received + i + 1}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <ul className="qnav__legend" aria-label="Legend">
        <li><span className="qbtn qbtn--demo is-answered"><Icon name="check" size={10} /></span> Answered</li>
        <li><span className="qbtn qbtn--demo is-flagged"><Icon name="flag" size={10} /></span> Flagged</li>
        <li><span className="qbtn qbtn--demo is-current" /> Current</li>
      </ul>
    </nav>
  );

  return (
    <div className="exam">
      <a className="skip-link" href="#main-content">
        Skip to question
      </a>
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      <header className="exam-bar">
        <div className="exam-bar__inner">
          <div className="exam-bar__title">
            <Logo iconOnly to={null} size="sm" />
            <div>
              <p className="exam-bar__name">{exam.title}</p>
              <p className="exam-bar__meta">
                {exam.subject} · Year {exam.year} · {exam.examType === "cat" ? "CAT" : "Full exam"}
              </p>
            </div>
          </div>

          <div className="exam-bar__progress" aria-label={`${answeredCount} of ${total} answered`}>
            <span>
              {answeredCount}/{total}
              {arriving && !stream.expected ? "+" : ""} answered
            </span>
            <div className="exam-bar__track">
              <i style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="exam-bar__actions">
            <div className={`timer ${timerClass}`} role="timer" aria-label="Time remaining">
              <Icon name={remaining <= 120 ? "alertTriangle" : "timer"} size={16} />
              <span>{formatClock(remaining, exam.durationMinutes >= 60)}</span>
            </div>
            <Button variant="ghost" size="sm" iconLeft="info" onClick={() => setInfoOpen(true)} className="hide-sm">
              Instructions
            </Button>
            <Button variant="secondary" size="sm" iconLeft="layers" onClick={() => setNavOpen(true)} className="show-lg-hide">
              Questions
            </Button>
            <Button
              size="sm"
              iconLeft="send"
              onClick={() => setConfirmOpen(true)}
              disabled={submitting || !canSubmit}
              title={canSubmit ? undefined : lockHint}
              className={`exam-submit ${canSubmit ? "" : "is-locked"}`}
            >
              Submit
            </Button>
          </div>
        </div>
      </header>

      <div className="exam-body">
        <aside className="exam-side">{navigator}</aside>

        <main id="main-content" tabIndex={-1} className="exam-main">
          {delivery !== "idle" ? (
            <Alert
              tone={delivery === "error" ? "warning" : "info"}
              title={delivery === "error" ? "Payment confirmation not saved yet" : "Saving payment confirmation…"}
              action={
                delivery === "error" ? (
                  <Button size="sm" variant="secondary" onClick={() => void confirmDelivery()}>
                    Retry confirmation
                  </Button>
                ) : null
              }
            >
              {delivery === "error"
                ? "Your assessment is ready, but we could not confirm the payment status. Retry confirmation; if it already succeeded, this retry is safe."
                : "Your assessment is ready. You can start answering."}
            </Alert>
          ) : null}
          {arriving ? (
            <div className="stream-banner" role="status">
              <span className="spinner spinner--sm" aria-hidden="true" />
              <div>
                <strong>
                  {received} {stream.expected ? `of ${total} ` : ""}question{received === 1 ? "" : "s"} ready
                </strong>
                <span>More are arriving while you work. Start answering now. Submit unlocks once every question has arrived and been answered.</span>
                {stream.expected ? (
                  <div className="stream-banner__track" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, (received / total) * 100)}%` }} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : justFinished ? (
            <Alert tone="success" title={`All ${received} questions are ready`}>
              Nothing more will arrive. You can submit whenever you are done.
            </Alert>
          ) : incomplete ? (
            <Alert tone="warning" title="Not every question arrived">
              {stream.interrupted
                ? `The page was reloaded while your questions were still arriving. You have ${received} question${received === 1 ? "" : "s"}; you can answer and submit these.`
                : `${stream.error ?? "The connection was interrupted."} You have ${received} question${received === 1 ? "" : "s"}; you can answer and submit these, or set up a new test.`}
            </Alert>
          ) : null}

          {index === 0 ? (
            <section className="card card--pad instructions" aria-labelledby="instr-title">
              <h2 id="instr-title" className="h5">
                Candidate instructions
              </h2>
              <ul>
                {instructionsFor(exam.examType).map((item) => (
                  <li key={item}>
                    <Icon name="check" size={16} /> {item}
                  </li>
                ))}
              </ul>
              <p className="muted">
                Time allowed: {formatDuration(exam.durationMinutes)}. Your answers are saved in this browser as you go.
              </p>
            </section>
          ) : null}

          <QuestionCard
            key={question.id}
            question={question}
            number={posInSection}
            sectionTitle={section?.title ?? ""}
            sectionCount={arriving && exam.examType === "cat" ? total : (section?.questions.length ?? total)}
            overall={index + 1}
            total={total}
            value={answers[question.id] ?? ""}
            onChange={(value) => setAnswer(question.id, value)}
            flagged={flagged.has(question.id)}
            onFlag={() => toggleFlag(question.id)}
          />

          <div className="exam-pager">
            <Button variant="secondary" iconLeft="arrowLeft" onClick={() => go(index - 1)} disabled={index === 0}>
              Previous
            </Button>
            <span className="muted" aria-hidden="true">
              {index + 1} / {total}
              {arriving && !stream.expected ? "+" : ""}
            </span>
            {index < received - 1 ? (
              <Button iconRight="arrowRight" onClick={() => go(index + 1)}>
                Next
              </Button>
            ) : arriving ? (
              <Button variant="secondary" disabled loading>
                Next question arriving…
              </Button>
            ) : (
              <Button iconRight="send" onClick={() => setConfirmOpen(true)} disabled={submitting || !canSubmit} className={canSubmit ? "" : "is-locked"}>
                Review &amp; submit
              </Button>
            )}
          </div>
          <p className={`submit-hint ${canSubmit ? "is-ready" : ""}`} role="status">
            <Icon name={canSubmit ? "checkCircle" : "lock"} size={15} /> {lockHint}
          </p>
        </main>
      </div>

      <Dialog open={navOpen} onClose={() => setNavOpen(false)} title="Question navigator" size="md">
        {navigator}
      </Dialog>

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} title="Candidate instructions" size="sm">
        <ul className="plain-list">
          {instructionsFor(exam.examType).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="muted">Time allowed: {formatDuration(exam.durationMinutes)}.</p>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit your answers?"
        description={
          incomplete
            ? `Only ${received} question${received === 1 ? "" : "s"} arrived. You have ${unanswered} unanswered. Unanswered questions score zero.`
            : unanswered
            ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Unanswered questions score zero.`
            : "You have answered every question."
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Keep reviewing
            </Button>
            <Button onClick={() => void submit()} loading={submitting} iconLeft="send">
              Submit {exam.examType === "cat" ? "CAT" : "exam"}
            </Button>
          </>
        }
      >
        <ul className="confirm-stats">
          <li><strong>{answeredCount}</strong> answered</li>
          <li><strong>{unanswered}</strong> unanswered</li>
          <li><strong>{flagged.size}</strong> flagged</li>
        </ul>
      </Dialog>

      <Dialog open={nameOpen} onClose={() => {}} dismissible={false} title="Before you view your result" description="Your email does not identify your name. Enter your name to continue." size="sm" initialFocusId="candidate-name">
        <form onSubmit={onNameSubmit} className="form" noValidate>
          <TextField
            id="candidate-name"
            label="Your name"
            name="displayName"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={nameError || undefined}
            required
          />
          <Button type="submit" block>
            Save name and continue
          </Button>
        </form>
      </Dialog>

      {submitting ? (
        <div className="marking" role="status" aria-live="polite">
          <div className="marking__card">
            <span className="spinner spinner--lg" aria-hidden="true" />
            <p>Marking your answers…</p>
            <span className="muted">Please keep this page open.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuestionCard({
  question,
  number,
  sectionTitle,
  sectionCount,
  overall,
  total,
  value,
  onChange,
  flagged,
  onFlag,
}: {
  question: ViewQuestion;
  number: number;
  sectionTitle: string;
  sectionCount: number;
  overall: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  flagged: boolean;
  onFlag: () => void;
}) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <article className="qcard" aria-labelledby="q-title">
      <div className="qcard__head">
        <div>
          <Badge tone={question.type === "mcq" ? "accent" : "gold"}>{question.type.toUpperCase()}</Badge>
          <h2 id="q-title" className="qcard__num">
            Question {number}
            <span className="muted"> of {sectionCount}</span>
          </h2>
          <p className="muted qcard__sec">
            {sectionTitle} · overall {overall}/{total}
            {question.totalMarks ? ` · ${question.totalMarks} marks` : ""}
          </p>
        </div>
        <button type="button" className={`flag-btn ${flagged ? "is-on" : ""}`} onClick={onFlag} aria-pressed={flagged}>
          <Icon name="flag" size={16} /> {flagged ? "Flagged" : "Flag for review"}
        </button>
      </div>

      <p className="qcard__prompt">{question.prompt}</p>

      {question.type === "saq" && question.subQuestions.length ? (
        <ul className="subq">
          {question.subQuestions.map((sub, i) => (
            <li key={i}>
              <strong>{sub?.question || "Question"}</strong> {sub?.marks ? <span className="muted">({sub.marks} marks)</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {question.type === "mcq" ? (
        <div className="options" role="radiogroup" aria-labelledby="q-title">
          {question.options.map((option, i) => {
            const selected = value === option;
            return (
              <label key={`${question.id}-${i}`} className={`option ${selected ? "is-selected" : ""}`}>
                <input type="radio" name={question.id} value={option} checked={selected} onChange={() => onChange(option)} />
                <span className="option__letter" aria-hidden="true">
                  {optionLetter(i)}
                </span>
                <span className="option__text">{option}</span>
                <Icon name="check" size={18} className="option__tick" />
              </label>
            );
          })}
        </div>
      ) : (
        <div className="written">
          <label className="sr-only" htmlFor="written-answer">
            Your answer
          </label>
          <textarea
            id="written-answer"
            className="input input--area input--written"
            name={question.id}
            rows={question.type === "essay" ? 16 : 9}
            placeholder={question.type === "saq" ? "Write a concise short-answer response…" : "Write your essay response here…"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="muted written__count">{words} word{words === 1 ? "" : "s"}</p>
        </div>
      )}
    </article>
  );
}

function ResultScreen({ exam, result, onNavigate }: { exam: ViewExam; result: ExamResult; onNavigate: (to: string) => void }) {
  const marks = Number(result.totalMarks) || 0;
  const score = Number(result.totalScore) || 0;
  const percent = marks ? (score / marks) * 100 : null;
  return (
    <div className="result">
      <div className="result__card">
        <Logo to={null} />
        <p className="eyebrow">{exam.examType === "cat" ? "CAT" : "Exam"} submitted</p>
        <h1 className="h2">{exam.title}</h1>
        <RingGauge value={percent} size={168} label="Your score" caption={`${score}/${marks}`} />
        <dl className="result__split">
          <div>
            <dt>MCQs</dt>
            <dd>
              {result.mcqScore ?? 0}/{result.mcqTotal ?? 0}
            </dd>
          </div>
          <div>
            <dt>Written</dt>
            <dd>
              {result.writtenScore ?? 0}/{result.writtenTotal ?? 0}
            </dd>
          </div>
        </dl>
        <p className="muted">Your answers, marking feedback and explanations are saved in Performance.</p>
        <div className="result__actions">
          <Button size="lg" iconRight="arrowRight" onClick={() => onNavigate("/performance")}>
            Review results
          </Button>
          <Button variant="secondary" size="lg" onClick={() => onNavigate("/portal")}>
            Back to overview
          </Button>
        </div>
      </div>
    </div>
  );
}
