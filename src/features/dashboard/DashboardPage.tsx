import type { ReactNode } from "react";
import { Alert, Badge, EmptyState, Meter, Skeleton } from "../../components/ui/Feedback";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { RingGauge } from "../../components/charts/TrendChart";
import { useAsync } from "../../hooks/useAsync";
import { api, request } from "../../lib/api";
import { CountUp, Reveal } from "../../lib/motion";
import { usePageMeta } from "../../lib/meta";
import { formatDate, getGreeting, lastNameFromEmail, pct, plural } from "../../lib/format";
import {
  completedRecords,
  dashAssessmentType,
  normalizeDashRecord,
  subjectProgress,
  summarize,
  type DashRecord,
} from "../../lib/records";
import type { ExamRecord, TrialsResponse } from "../../types/api";
import { useAuth } from "../auth/AuthContext";

interface DashData {
  records: DashRecord[];
  trials: TrialsResponse["available"] | null;
}

async function loadDashboard(signal: AbortSignal): Promise<DashData> {
  const [examsData, trialsResult] = await Promise.all([
    api<{ exams?: ExamRecord[] }>("/api/exams", { signal, fallbackMessage: "Could not load your overview." }),
    // Free-trial availability is informational here; the Exam Room re-checks it on the server when you start.
    request<TrialsResponse>("/api/exam-trials", { signal }).catch(() => null),
  ]);
  return {
    records: (examsData.exams || []).map(normalizeDashRecord),
    trials: trialsResult?.ok ? (trialsResult.data.available ?? {}) : null,
  };
}

function nextAction(data: DashData) {
  const progress = subjectProgress(data.records);
  if (data.trials?.cat) {
    return {
      badge: "Free CAT available",
      title: "Your free CAT is ready",
      text: "Pick a subject and topic and find out where you stand. It costs nothing.",
      to: "/examroom?type=cat",
      cta: "Start your free CAT",
    };
  }
  if (data.trials?.exam) {
    return {
      badge: "Free full exam available",
      title: "Your free full exam is waiting",
      text: "Rehearse the real thing: MCQs, short answers and an essay against the clock.",
      to: "/examroom?type=exam",
      cta: "Start your free full exam",
    };
  }
  const done = completedRecords(data.records);
  if (!done.length) {
    return {
      badge: "Get started",
      title: "Take your first assessment",
      text: "Your results, feedback and progress will appear here once you complete one.",
      to: "/examroom",
      cta: "Open the Exam Room",
    };
  }
  const weakest = [...progress].sort((a, b) => a.current - b.current)[0];
  if (weakest) {
    return {
      badge: "Suggested next step",
      title: `Revisit ${weakest.subject}`,
      text: `It’s your lowest subject so far (${pct(weakest.current)} on your latest result). A fresh attempt is a good way to check progress.`,
      to: `/examroom?subject=${encodeURIComponent(weakest.subject)}`,
      cta: "Practise this subject",
    };
  }
  return { badge: "Keep going", title: "Take another assessment", text: "Regular practice shows you what to revise.", to: "/examroom", cta: "Open the Exam Room" };
}

function StatCard({ icon, label, children, note }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; children: ReactNode; note?: string }) {
  return (
    <div className="stat">
      <span className="stat__icon">
        <Icon name={icon} size={18} />
      </span>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{children}</p>
      {note ? <p className="stat__note">{note}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  usePageMeta({ title: "Overview | MDQ", path: "/portal" });
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(loadDashboard, []);

  const greeting = `${getGreeting()}, ${lastNameFromEmail(user?.studentEmail)}.`;
  const summary = data ? summarize(data.records) : null;
  const done = data ? completedRecords(data.records) : [];
  const latest = done.slice(0, 4);
  const progress = data ? subjectProgress(data.records) : [];
  const action = data ? nextAction(data) : null;

  return (
    <div className="dash">
      <Reveal className="welcome">
        <div className="welcome__glow" aria-hidden="true" />
        <div className="welcome__copy">
          <p className="eyebrow">Your study desk</p>
          <h2 className="h1" aria-live="polite">
            {error ? "Your overview could not be loaded." : greeting}
          </h2>
          <p className="muted">
            {done.length
              ? "Every attempt shows you something. Pick up where you left off."
              : "Practise a little, often. A single CAT is enough to find your first gaps."}
          </p>
        </div>
        <div className="welcome__actions">
          <ButtonLink to="/examroom" size="lg" iconRight="arrowRight">
            Start a test
          </ButtonLink>
          <ButtonLink to="/performance" variant="secondary" size="lg" iconLeft="chartLine">
            Review performance
          </ButtonLink>
        </div>
      </Reveal>

      {error ? (
        <Alert
          tone="error"
          title="We couldn’t load your assessment data"
          action={
            <Button size="sm" variant="secondary" onClick={reload} iconLeft="refresh">
              Try again
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      <section className="stats" aria-label="Your study summary" aria-live="polite" aria-busy={loading}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="skeleton--stat" />)
        ) : summary ? (
          <>
            <div className="stat stat--ring">
              <RingGauge value={summary.readiness} label="Exam readiness" caption="readiness" />
              <p className="stat__note">
                {summary.readiness != null
                  ? `Across ${plural(summary.completed, "completed assessment")}`
                  : "Complete an assessment to establish your baseline"}
              </p>
            </div>
            <StatCard icon="listChecks" label="Assessments completed" note="CATs and full exams">
              <CountUp value={summary.completed} />
            </StatCard>
            <StatCard icon="fileText" label="Questions answered" note="Across CATs and exams">
              <CountUp value={summary.answered} format={(n) => Math.round(n).toLocaleString()} />
            </StatCard>
            <StatCard icon="checkCircle" label="Free assessments left" note={data?.trials ? "Verified student account" : "Checked when you start"}>
              {data?.trials ? <CountUp value={Number(Boolean(data.trials.cat)) + Number(Boolean(data.trials.exam))} /> : "--"}
            </StatCard>
          </>
        ) : null}
      </section>

      {action ? (
        <Reveal className="next">
          <div>
            <Badge tone="gold" icon="target">
              {action.badge}
            </Badge>
            <h3 className="h3">{action.title}</h3>
            <p className="muted">{action.text}</p>
          </div>
          <ButtonLink to={action.to} iconRight="arrowRight" size="lg">
            {action.cta}
          </ButtonLink>
        </Reveal>
      ) : null}

      <div className="dash__cols">
        <section className="panel" aria-labelledby="recent-heading">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Your latest work</p>
              <h3 id="recent-heading" className="h4">
                Completed assessments
              </h3>
            </div>
            <ButtonLink to="/performance" variant="ghost" size="sm" iconRight="arrowRight">
              View all
            </ButtonLink>
          </div>
          {loading ? (
            <div className="tiles">
              <Skeleton className="skeleton--tile" />
              <Skeleton className="skeleton--tile" />
            </div>
          ) : latest.length ? (
            <ul className="tiles">
              {latest.map((record, index) => {
                const exam = record.exam;
                const score = Number(record.result.totalScore) || 0;
                const marks = Number(record.result.totalMarks) || 0;
                const type = dashAssessmentType(record);
                return (
                  <Reveal as="li" key={String(record.attemptId ?? record.examId ?? index)} className="tile" index={index}>
                    <div className="tile__top">
                      <Badge tone={type === "CAT" ? "accent" : "gold"}>{type}</Badge>
                      <time dateTime={record.completedAt}>{formatDate(record.completedAt)}</time>
                    </div>
                    <h4>{record.title || exam.title || "Medical assessment"}</h4>
                    <p className="muted">
                      {record.subject || exam.subject || "General Medicine"}
                      {record.year || exam.year ? ` · Year ${record.year || exam.year}` : ""}
                    </p>
                    <p className="tile__score">
                      {score}
                      <span> / {marks}</span>
                    </p>
                  </Reveal>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon="graduationCap"
              title="No completed assessments yet"
              action={
                <ButtonLink to="/examroom" size="sm">
                  Start your first test
                </ButtonLink>
              }
            >
              Your completed CATs and exams will appear here.
            </EmptyState>
          )}
        </section>

        <section className="panel" aria-labelledby="subject-heading">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Latest result per subject</p>
              <h3 id="subject-heading" className="h4">
                Subject performance
              </h3>
            </div>
          </div>
          {loading ? (
            <Skeleton className="skeleton--block" />
          ) : progress.length ? (
            <ul className="subjects">
              {progress.map((item) => (
                <li key={item.subject}>
                  <div className="subjects__row">
                    <span>{item.subject}</span>
                    <strong>{pct(item.current)}</strong>
                  </div>
                  <Meter value={item.current} label={`${item.subject} score`} tone={item.current >= 70 ? "accent" : item.current >= 50 ? "warning" : "danger"} />
                  <p className={`subjects__change ${item.change == null ? "" : item.change > 0 ? "is-up" : item.change < 0 ? "is-down" : ""}`}>
                    {item.change == null
                      ? "First recorded result"
                      : `${item.change > 0 ? "▲ +" : item.change < 0 ? "▼ " : "● "}${item.change} pts since last result`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="chartLine" title="No subject scores yet">
              Complete and submit a CAT or exam to see your subject scores.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
