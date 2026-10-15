import { useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Alert, Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Icon } from "../../components/ui/Icon";
import { TrendChart, type TrendPoint } from "../../components/charts/TrendChart";
import { Reveal } from "../../lib/motion";
import { api, errorMessage } from "../../lib/api";
import { formatDate, formatDateTime, pct } from "../../lib/format";
import { usePageMeta } from "../../lib/meta";
import { normalizeDisplayTitle } from "../../lib/exam";
import {
  computeInsights,
  historyType,
  normalizeHistoryRecord,
  percentOf,
  resolveOptionAnswer,
  type HistoryQuestionBase,
  type HistoryRecord,
} from "../../lib/records";
import { useNavigate } from "../../lib/router";
import { KEYS, clearAnswerDraft, safeRemove, saveCurrentExam } from "../../lib/storage";
import { useAsync } from "../../hooks/useAsync";
import type { ExamRecord, MarkingItem, SourceEvidence } from "../../types/api";

type Filter = "all" | "cat" | "exam";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "cat", label: "CATs" },
  { id: "exam", label: "Exams" },
];

function titleOf(record: HistoryRecord): string {
  return normalizeDisplayTitle(record.exam.title, historyType(record)) || "Medical Examination";
}

export default function PerformancePage() {
  usePageMeta({ title: "Performance | MDQ", path: "/performance" });
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewing, setReviewing] = useState<HistoryRecord | null>(null);

  const state = useAsync<HistoryRecord[]>(async (signal) => {
    const data = await api<{ exams?: ExamRecord[] }>("/api/exams", { signal, fallbackMessage: "Could not load assessments." });
    return (data.exams ?? []).map(normalizeHistoryRecord);
  });

  const records = state.data ?? [];
  const completed = useMemo(() => records.filter((record) => record.result), [records]);
  const insights = useMemo(() => computeInsights(completed), [completed]);
  const counts = useMemo(
    () => ({
      all: records.length,
      cat: records.filter((r) => historyType(r) === "cat").length,
      exam: records.filter((r) => historyType(r) === "exam").length,
    }),
    [records],
  );
  const visible = useMemo(() => records.filter((r) => filter === "all" || historyType(r) === filter), [records, filter]);

  const trend: TrendPoint[] = useMemo(
    () =>
      completed
        .filter((r) => r.completedAt && percentOf(r.result) !== null)
        .sort((a, b) => new Date(a.completedAt as string).getTime() - new Date(b.completedAt as string).getTime())
        .map((r) => ({
          label: formatDate(r.completedAt).replace(/,? \d{4}$/, ""),
          value: percentOf(r.result) as number,
          title: titleOf(r),
          detail: `${historyType(r) === "cat" ? "CAT" : "Exam"} · ${String(r.exam.subject || "General Medicine")} · ${r.result?.totalScore ?? 0}/${r.result?.totalMarks ?? 0}`,
        })),
    [completed],
  );

  const open = (record: HistoryRecord) => {
    if (!record.result) {
      // Same behaviour as the original: an un-taken saved assessment is reopened in the exam interface.
      saveCurrentExam(record.exam);
      safeRemove(KEYS.currentExamResult);
      clearAnswerDraft();
      navigate("/examinterface");
      return;
    }
    setReviewing(record);
  };

  return (
    <div className="perf">
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">Your progress</p>
          <h2 className="h1">Performance</h2>
          <p className="muted">Review saved assessments, see how your scores move over time and decide what to study next.</p>
        </div>
      </Reveal>

      {state.loading ? (
        <div className="perf__loading" aria-busy="true" aria-label="Loading assessments">
          <Skeleton className="skeleton--block" style={{ height: 150 }} />
          <Skeleton className="skeleton--block" style={{ height: 260 }} />
          <Skeleton className="skeleton--block" style={{ height: 120 }} />
        </div>
      ) : state.error ? (
        <Alert
          tone="error"
          title="Assessments could not be loaded"
          action={
            <Button size="sm" variant="secondary" onClick={state.reload}>
              Try again
            </Button>
          }
        >
          {state.error}
        </Alert>
      ) : !records.length ? (
        <EmptyState
          icon="barChart"
          title="No saved assessments yet"
          action={
            <Button iconRight="arrowRight" onClick={() => navigate("/examroom")}>
              Take your first assessment
            </Button>
          }
        >
          Generated CATs and exams will be saved here.
        </EmptyState>
      ) : (
        <>
          {insights ? (
            <section className="card card--pad insights" aria-labelledby="insights-title">
              <div className="insights__head">
                <div>
                  <p className="eyebrow">Progress guide</p>
                  <h3 id="insights-title" className="h3">
                    Strengths and areas to improve
                  </h3>
                </div>
                <Badge tone="accent">
                  Based on {insights.count} completed {insights.count === 1 ? "assessment" : "assessments"}
                </Badge>
              </div>
              <div className="insights__grid">
                <article className="insight insight--good">
                  <span className="insight__label">
                    <Icon name="trendingUp" size={15} /> Strengths
                  </span>
                  <strong>{insights.strengths.length ? insights.strengths.join(" · ") : "Keep building your baseline"}</strong>
                  <p>
                    {insights.subjects[0]
                      ? `${insights.subjects[0].name} leads at ${pct(insights.subjects[0].percentage)}.`
                      : "Complete more assessments to identify your strongest areas."}
                  </p>
                </article>
                <article className="insight insight--warn">
                  <span className="insight__label">
                    <Icon name="target" size={15} /> Needs review
                  </span>
                  <strong>{insights.weaknesses.length ? insights.weaknesses.join(" · ") : "No critical gaps yet"}</strong>
                  <p>Focus next on {insights.nextFocus}.</p>
                </article>
              </div>
              {trend.length ? (
                <div className="insights__chart">
                  <h4 className="h5">Score over time</h4>
                  <TrendChart
                    points={trend}
                    summary={`Score percentage over ${trend.length} completed ${trend.length === 1 ? "assessment" : "assessments"}`}
                  />
                </div>
              ) : null}
              <div className="insights__bars">
                <h4 className="h5">By subject</h4>
                <ul className="bars">
                  {insights.subjects.map((s) => (
                    <li key={s.name}>
                      <span className="bars__name">{s.name}</span>
                      <span className="bars__track" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, s.percentage)}%` }} />
                      </span>
                      <span className="bars__val">{pct(s.percentage)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <Alert tone="info" title="No completed assessments yet">
              Open a saved assessment below and finish it to see your strengths and score trend.
            </Alert>
          )}

          <div className="perf__list-head">
            <h3 className="h3">Saved assessments</h3>
            <div className="seg" role="group" aria-label="Filter assessments">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`seg__btn ${filter === item.id ? "is-active" : ""}`}
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label} <span className="seg__count">{counts[item.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {visible.length ? (
            <ul className="results">
              {visible.map((record, i) => {
                const result = record.result;
                const date = record.completedAt || record.generatedAt;
                const type = historyType(record);
                return (
                  <li key={`${record.attemptId ?? record.exam.examId ?? "x"}-${i}`}>
                    <button type="button" className="result-card" onClick={() => open(record)}>
                      <span className="result-card__top">
                        <span>
                          <span className="result-card__date">
                            {record.completedAt ? "Completed" : "Generated"} {formatDateTime(date, "exam")}
                          </span>
                          <span className="result-card__title">{titleOf(record)}</span>
                          <span className="muted">
                            {String(record.exam.subject || "General Medicine")} · Year {String(record.exam.year || "N/A")}
                          </span>
                        </span>
                        <span className="result-card__score">
                          <strong>{result ? `${result.totalScore ?? 0}/${result.totalMarks ?? 0}` : "Not taken"}</strong>
                          <small>{result ? "Final score" : "Saved assessment"}</small>
                        </span>
                      </span>
                      <span className="result-card__bottom">
                        <Badge tone={type === "cat" ? "accent" : "gold"}>{type === "cat" ? "CAT" : "Exam"}</Badge>
                        {result ? (
                          <>
                            <span>
                              MCQs: {result.mcqScore ?? 0}/{result.mcqTotal ?? 0}
                            </span>
                            <span>
                              Written: {result.writtenScore ?? 0}/{result.writtenTotal ?? 0}
                            </span>
                          </>
                        ) : (
                          <span>Open this saved assessment to take it.</span>
                        )}
                        <span className="result-card__hint">
                          {result ? "Open full review" : "Reopen assessment"} <Icon name="arrowRight" size={14} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="listChecks" title={`No ${filter === "cat" ? "CAT" : "exam"} results yet`}>
              Completed assessments in this category will appear here.
            </EmptyState>
          )}
        </>
      )}

      <ReviewDialog record={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}

function ReviewDialog({ record, onClose }: { record: HistoryRecord | null; onClose: () => void }) {
  const result = record?.result;
  const resultById = useMemo(
    () =>
      new Map<string, MarkingItem>(
        [...(result?.mcqResults ?? []), ...(result?.writtenResults ?? [])].map((item) => [String(item.id), item]),
      ),
    [result],
  );
  return (
    <Dialog
      open={record !== null}
      onClose={onClose}
      size="xl"
      title={record ? titleOf(record) : ""}
      description={
        record
          ? `${String(record.exam.subject || "General Medicine")} · Year ${String(record.exam.year || "N/A")} · ${formatDateTime(record.completedAt, "Completed exam")}`
          : undefined
      }
    >
      {record && result ? (
        <div className="review">
          <div className="review__score">
            <span>{historyType(record) === "cat" ? "CAT" : "Exam"} review</span>
            <strong>
              Score: {result.totalScore ?? 0}/{result.totalMarks ?? 0}
            </strong>
          </div>
          {historyType(record) === "cat" && record.attemptId ? <ShareCat attemptId={String(record.attemptId)} /> : null}
          <div className="review__list">
            {(record.exam.questions ?? []).map((question, index) => (
              <QuestionReview key={`${question.id}-${index}`} question={question} index={index} answers={record.answers} marking={resultById.get(String(question.id))} />
            ))}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function Sources({ sources }: { sources: unknown }) {
  if (!Array.isArray(sources) || !sources.length) return null;
  return (
    <details className="sources">
      <summary>Verified source passages</summary>
      <ul>
        {(sources as SourceEvidence[]).map((source, i) => (
          <li key={i}>
            <strong>{source.title || "Source"}</strong>
            <code>{source.reference || source.type || "Source"}</code>
            {source.quote ? <blockquote>{source.quote}</blockquote> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function QuestionReview({
  question,
  index,
  answers,
  marking,
}: {
  question: HistoryQuestionBase;
  index: number;
  answers: Record<string, unknown>;
  marking: MarkingItem | undefined;
}) {
  const submitted = String((answers[String(question.id)] ?? answers[question.id as string]) || "No answer submitted");
  if (question.type === "mcq") {
    const options = question.options;
    const correct = resolveOptionAnswer(question.correctAnswer || "Not provided", options);
    const mine = resolveOptionAnswer(submitted, options);
    const ok = Boolean(marking?.correct);
    return (
      <article className={`qreview ${ok ? "is-correct" : "is-incorrect"}`}>
        <div className="qreview__head">
          <span>MCQ {index + 1}</span>
          <strong>
            <Icon name={ok ? "checkCircle" : "xCircle"} size={16} /> {ok ? "Correct" : "Incorrect"}
          </strong>
        </div>
        <p className="qreview__prompt">{question.prompt}</p>
        <dl>
          <dt>Your answer</dt>
          <dd>{mine}</dd>
          <dt>Correct answer</dt>
          <dd>{correct}</dd>
          <dt>Explanation</dt>
          <dd>{marking?.explanation || (question.explanation as string | undefined) || "No explanation provided."}</dd>
        </dl>
        <Sources sources={question.sourceEvidence} />
      </article>
    );
  }
  const max = marking?.maxScore ?? (question.type === "essay" ? 20 : (question.totalMarks as number | string | undefined) || 15);
  return (
    <article className="qreview qreview--written">
      <div className="qreview__head">
        <span>
          {String(question.type || "Written").toUpperCase()} {index + 1}
        </span>
        <strong>
          {marking?.score ?? 0}/{max}
        </strong>
      </div>
      <p className="qreview__prompt">{question.prompt}</p>
      <dl>
        <dt>Your answer</dt>
        <dd className="pre">{submitted}</dd>
        <dt>Feedback</dt>
        <dd>{marking?.feedback || "No feedback returned."}</dd>
      </dl>
      <Sources sources={question.sourceEvidence} />
    </article>
  );
}

/** POST /api/cat-shares { attemptId } → { token }. The link is /shared-cat?token=… (same as the original). */
function ShareCat({ attemptId }: { attemptId: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [link, setLink] = useState("");
  const field = useRef<HTMLInputElement>(null);

  const share = async () => {
    setBusy(true);
    setStatus("Creating your share link…");
    try {
      const data = await api<{ token: string }>("/api/cat-shares", {
        method: "POST",
        json: { attemptId },
        fallbackMessage: "Could not create a share link.",
      });
      const url = new URL("/shared-cat", window.location.origin);
      url.searchParams.set("token", data.token);
      setLink(url.href);
      requestAnimationFrame(() => field.current?.select());
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "My CAT result", text: "I took this CAT. Can you beat my score?", url: url.href });
          setStatus("Share link ready.");
          return;
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === "AbortError") {
            setStatus("Share link ready to copy.");
            return;
          }
          console.error("Could not open the share sheet:", cause);
        }
      }
      try {
        await navigator.clipboard.writeText(url.href);
        setStatus("Link copied. Drop it in your class WhatsApp group.");
      } catch (cause) {
        console.error("Could not copy CAT share link:", cause);
        setStatus("Copy the share link below and send it to your class.");
      }
    } catch (cause) {
      console.error("Could not share CAT result:", cause);
      setStatus(errorMessage(cause, "Could not create a share link."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="share">
      <Button variant="secondary" size="sm" iconLeft="share" loading={busy} onClick={() => void share()}>
        Share result
      </Button>
      <p className="share__status" role="status" aria-live="polite">
        {status}
      </p>
      {link ? <input ref={field} className="input share__url" aria-label="CAT share link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} /> : null}
    </div>
  );
}
