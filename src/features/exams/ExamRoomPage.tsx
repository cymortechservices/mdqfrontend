import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Badge } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { SelectField, TextField } from "../../components/ui/Field";
import { Reveal } from "../../lib/motion";
import { request } from "../../lib/api";
import { ASSESSMENTS, SUBJECT_SUGGESTIONS, formatPrice, type TestType } from "../../lib/config";
import { usePageMeta } from "../../lib/meta";
import { useNavigate, useSearchParams } from "../../lib/router";
import type { TrialsResponse } from "../../types/api";
import { FileDrop } from "./FileDrop";
import { GeneratingOverlay } from "./GeneratingOverlay";
import { PaymentConfirmDialog, PaymentWaitingDialog, type PaymentRequest } from "./PaymentDialog";
import { StartError, startAssessment, type StartStage } from "./startAssessment";

const STAGE_LABEL: Record<StartStage, string> = {
  promo: "Checking promo code",
  "payment-check": "Checking access",
  trial: "Checking free trial",
  payment: "Payment",
  generate: "Generating assessment",
};
const STAGE_ORDER: StartStage[] = ["payment-check", "trial", "payment", "generate"];

type Errors = Partial<Record<"type" | "year" | "subject", string>>;

export default function ExamRoomPage() {
  usePageMeta({ title: "Exam Room | MDQ", path: "/examroom" });
  const navigate = useNavigate();
  const params = useSearchParams();

  const initialType = params.get("type") === "exam" ? "exam" : params.get("type") === "cat" ? "cat" : "";
  const [testType, setTestType] = useState<TestType | "">(initialType);
  const [year, setYear] = useState("");
  const [subject, setSubject] = useState(params.get("subject") ?? "");
  const [topic, setTopic] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  const [trials, setTrials] = useState<TrialsResponse["available"] | null>(null);
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState<StartStage | null>(null);
  const [status, setStatus] = useState<{ text: string; tone: "info" | "success" | "error" } | null>(null);
  const [payRequest, setPayRequest] = useState<PaymentRequest | null>(null);
  const [waiting, setWaiting] = useState<{ attempt: number; max: number } | null>(null);
  const controller = useRef<AbortController | null>(null);

  // Informational only: the authoritative trial check happens on the server when you press START.
  useEffect(() => {
    const abort = new AbortController();
    request<TrialsResponse>("/api/exam-trials", { signal: abort.signal })
      .then((result) => result.ok && setTrials(result.data.available ?? {}))
      .catch(() => undefined);
    return () => abort.abort();
  }, []);

  // Abort any in-flight start when leaving the page.
  useEffect(() => () => controller.current?.abort(), []);

  const info = testType ? ASSESSMENTS[testType] : null;
  const priceNote = useMemo(() => {
    if (!testType) return null;
    if (trials?.[testType]) return "Free: your trial for this type is available";
    return `${formatPrice(ASSESSMENTS[testType].price)} per assessment, paid with M-Pesa`;
  }, [testType, trials]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (working) return;
    const next: Errors = {};
    if (!testType) next.type = "Choose CAT or full exam";
    if (!year) next.year = "Select your year of study";
    if (!subject.trim()) next.subject = "Enter a subject";
    setErrors(next);
    if (Object.keys(next).length || !testType) return;

    const abort = new AbortController();
    controller.current = abort;
    setWorking(true);
    setStatus(null);
    try {
      const exam = await startAssessment(
        { testType, promoCode, year, subject: subject.trim(), topic: topic.trim(), files },
        {
          signal: abort.signal,
          status: (text, tone) => setStatus(text ? { text, tone } : null),
          stage: setStage,
          paymentWaiting: setWaiting,
          requestPayment: (type, amount) =>
            new Promise<string | null>((resolve) => {
              setPayRequest({
                testType: type,
                amount,
                resolve: (phone) => {
                  setPayRequest(null);
                  resolve(phone);
                },
              });
            }),
        },
      );
      if (exam) navigate("/examinterface");
      else setStatus(null);
    } catch (error) {
      console.error("Could not start assessment:", error instanceof StartError ? error.message : error);
      setStatus({ text: error instanceof Error ? error.message : "Could not start the assessment.", tone: "error" });
    } finally {
      setWorking(false);
      setStage(null);
    }
  };

  const generating = working && stage === "generate";

  return (
    <div className="room">
      <Reveal className="room__intro">
        <p className="eyebrow">Personalised assessment</p>
        <h2 className="h1">Build your next test</h2>
        <p className="muted">Choose an assessment, focus area and study materials to get started.</p>
      </Reveal>

      <form className="room__grid" onSubmit={onSubmit} noValidate aria-busy={working}>
        <div className="room__main">
          <fieldset className="card card--pad" disabled={working}>
            <legend className="card__legend">1 · Choose your assessment</legend>
            <div className="choices" role="radiogroup" aria-label="Test type" aria-describedby={errors.type ? "type-error" : undefined}>
              {(["cat", "exam"] as const).map((type) => {
                const a = ASSESSMENTS[type];
                const selected = testType === type;
                return (
                  <label key={type} className={`choice ${selected ? "is-selected" : ""}`}>
                    <input type="radio" name="test-type" value={type} checked={selected} onChange={() => setTestType(type)} />
                    <span className="choice__check" aria-hidden="true">
                      <Icon name="check" size={14} />
                    </span>
                    <span className="choice__body">
                      <span className="choice__title">
                        <Icon name={type === "cat" ? "listChecks" : "graduationCap"} size={20} />
                        {a.label}
                      </span>
                      <span className="choice__meta">{a.questions}</span>
                      <span className="choice__text">{type === "cat" ? "MCQs for quick practice" : "Timed MCQs, SAQs and essay"}</span>
                      <span className="choice__foot">
                        <span className="choice__time">
                          <Icon name="timer" size={14} /> {a.minutes >= 60 ? `${Math.floor(a.minutes / 60)} h ${a.minutes % 60 ? `${a.minutes % 60} min` : ""}` : `${a.minutes} min`}
                        </span>
                        {trials?.[type] ? <Badge tone="gold" icon="checkCircle">1 free available</Badge> : <Badge>{formatPrice(a.price)}</Badge>}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.type ? (
              <p className="field__error" id="type-error" role="alert">
                <Icon name="alertCircle" size={15} /> <span>{errors.type}</span>
              </p>
            ) : null}
            <p className="field__hint room__explain">
              A CAT contains 50 MCQs only. A full exam contains 90 MCQs, 3 SAQs and 1 essay; its timer makes it a dress rehearsal for the real thing. New accounts get
              one free CAT and one free full exam after email verification. After that, CATs cost {formatPrice(ASSESSMENTS.cat.price)} and full exams cost {formatPrice(ASSESSMENTS.exam.price)}.
            </p>
          </fieldset>

          <fieldset className="card card--pad" disabled={working}>
            <legend className="card__legend">2 · Study details</legend>
            <div className="form form--grid">
              <SelectField label="Year of study" name="year" value={year} onChange={(event) => setYear(event.target.value)} error={errors.year} required>
                <option value="">Select your year</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    Year {n}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Subject"
                name="subject"
                list="subject-suggestions"
                placeholder="e.g. Pharmacology"
                autoComplete="off"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                hint="Type or choose a suggestion"
                error={errors.subject}
                required
              />
              <datalist id="subject-suggestions">
                {SUBJECT_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <TextField label="Topics" name="topic" optional placeholder="e.g. Upper limb anatomy" value={topic} onChange={(event) => setTopic(event.target.value)} />
              <TextField
                label="Promo code"
                name="promoCode"
                optional
                placeholder="Enter your access code"
                autoComplete="off"
                autoCapitalize="characters"
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value)}
                hint="Checked with the server when you press Start."
              />
            </div>
          </fieldset>

          <fieldset className="card card--pad" disabled={working}>
            <legend className="card__legend">3 · Study materials</legend>
            <p className="muted room__note">Add notes to guide your assessment. Leave this empty to use the built-in textbooks.</p>
            <FileDrop files={files} onChange={setFiles} disabled={working} />
          </fieldset>
        </div>

        <aside className="room__side" aria-label="Assessment summary">
          <div className="card card--pad summary">
            <p className="eyebrow">Your assessment</p>
            {info ? (
              <>
                <h3 className="h3">{info.label}</h3>
                <dl className="summary__list">
                  <div><dt>Questions</dt><dd>{info.questions}</dd></div>
                  <div><dt>Time allowed</dt><dd>{info.minutes >= 60 ? `${Math.floor(info.minutes / 60)} h ${info.minutes % 60 ? `${info.minutes % 60} min` : ""}` : `${info.minutes} min`}</dd></div>
                  <div><dt>Year</dt><dd>{year ? `Year ${year}` : "Not selected"}</dd></div>
                  <div><dt>Subject</dt><dd>{subject.trim() || "Not entered"}</dd></div>
                  <div><dt>Cost</dt><dd>{promoCode.trim() ? "Promo code (checked on start)" : priceNote}</dd></div>
                </dl>
              </>
            ) : (
              <p className="muted">Choose CAT or full exam to see what’s included.</p>
            )}

            <Button type="submit" size="lg" block loading={working} iconRight="arrowRight" id="start-exam">
              {working ? (generating ? "Generating…" : "Working…") : "Start"}
            </Button>

            {working || status ? (
              <div className="progress-panel">
                {working ? (
                  <ol className="stages" aria-label="Progress">
                    {STAGE_ORDER.map((s) => {
                      const current = stage === s || (s === "payment-check" && stage === "promo");
                      const passed = stage ? STAGE_ORDER.indexOf(stage === "promo" ? "payment-check" : stage) > STAGE_ORDER.indexOf(s) : false;
                      return (
                        <li key={s} className={current ? "is-current" : passed ? "is-done" : ""} aria-current={current ? "step" : undefined}>
                          <Icon name={passed ? "checkCircle" : "circle"} size={16} />
                          {STAGE_LABEL[s]}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                {status ? (
                  <Alert tone={status.tone === "error" ? "error" : status.tone === "success" ? "success" : "info"}>
                    {status.text}
                
                  </Alert>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      </form>

      {generating && testType ? <GeneratingOverlay testType={testType} subject={subject.trim()} year={year} /> : null}
      <PaymentConfirmDialog request={payRequest} />
      <PaymentWaitingDialog progress={waiting} onStop={() => controller.current?.abort()} />
    </div>
  );
}
