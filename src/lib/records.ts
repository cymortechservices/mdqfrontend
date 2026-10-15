/**
 * Score maths for the dashboard and performance pages. These are straight ports of the
 * calculations in the original portal.js / performance.js — the numbers must not change.
 */
import type { ExamPayload, ExamRecord, ExamResult } from "../types/api";
import { getExamType, hasAnswer } from "./exam";
import type { TestType } from "./config";

/** ---- Dashboard (portal.js) shape --------------------------------------------------- */

export interface DashRecord extends ExamRecord {
  exam: ExamPayload;
  answers: Record<string, unknown>;
  result: ExamResult | null;
}

export function normalizeDashRecord(record: ExamRecord): DashRecord {
  return { ...record, exam: record.exam || {}, answers: record.answers || {}, result: record.result || null };
}

export function completedRecords(records: DashRecord[]): (DashRecord & { result: ExamResult })[] {
  return records
    .filter((record): record is DashRecord & { result: ExamResult } => Boolean(record.completedAt && record.result))
    .sort((a, b) => new Date(b.completedAt as string).getTime() - new Date(a.completedAt as string).getTime());
}

export function dashAssessmentType(record: DashRecord): "CAT" | "Exam" {
  const type = String(record.testType || record.exam.examType || record.exam.type || "exam");
  return type.toLowerCase() === "cat" ? "CAT" : "Exam";
}

export interface Summary {
  completed: number;
  readiness: number | null;
  answered: number;
  scoreTotal: number;
  marksTotal: number;
}

export function summarize(records: DashRecord[]): Summary {
  const done = completedRecords(records);
  const totals = done.reduce(
    (acc, record) => ({
      score: acc.score + (Number(record.result.totalScore) || 0),
      marks: acc.marks + (Number(record.result.totalMarks) || 0),
    }),
    { score: 0, marks: 0 },
  );
  const answered = done.reduce((count, record) => count + Object.values(record.answers).filter(hasAnswer).length, 0);
  return {
    completed: done.length,
    readiness: totals.marks ? Math.round((totals.score / totals.marks) * 100) : null,
    answered,
    scoreTotal: totals.score,
    marksTotal: totals.marks,
  };
}

export interface SubjectProgress {
  subject: string;
  current: number;
  /** Change in percentage points versus the previous result, or null for the first result. */
  change: number | null;
  results: number;
}

/** Latest percentage per subject plus movement since the previous result (portal.js renderSubjectProgress). */
export function subjectProgress(records: DashRecord[]): SubjectProgress[] {
  const bySubject = new Map<string, number[]>();
  for (const record of completedRecords(records)) {
    const marks = Number(record.result.totalMarks) || 0;
    if (!marks) continue;
    const subject = record.subject || record.exam.subject || "General Medicine";
    const history = bySubject.get(subject) ?? [];
    history.push((Number(record.result.totalScore) / marks) * 100);
    bySubject.set(subject, history);
  }
  return [...bySubject.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([subject, history]) => {
      const current = history[0] ?? 0;
      const previous = history[1];
      return {
        subject,
        current,
        change: previous == null ? null : Math.round(current - previous),
        results: history.length,
      };
    });
}

/** ---- Performance (performance.js) shape --------------------------------------------- */

export interface HistoryQuestionBase {
  id: string | number;
  type: "mcq" | "saq" | "essay";
  prompt: string;
  [extra: string]: unknown;
}

export interface HistoryRecord {
  exam: Omit<ExamPayload, "questions"> & { examType: string; questions: HistoryQuestionBase[] };
  answers: Record<string, unknown>;
  result: ExamResult | null;
  attemptId?: string | number;
  completedAt?: string;
  generatedAt?: string;
}

export function normalizeHistoryRecord(saved: ExamRecord): HistoryRecord {
  const generated = (saved.exam || {}) as ExamPayload;
  const mcqs = Array.isArray(generated.mcqs) ? generated.mcqs : [];
  const saqs = Array.isArray(generated.saqs) ? generated.saqs : [];
  const essays = Array.isArray(generated.essay) ? generated.essay : generated.essay ? [generated.essay] : [];

  const questions: HistoryQuestionBase[] = [
    ...mcqs.map((q, i) => ({
      ...q,
      id: q.id ?? `mcq-${i + 1}`,
      type: "mcq" as const,
      prompt: q.prompt || q.question || `Question ${i + 1}`,
    })),
    ...saqs.map((q, i) => ({
      ...q,
      id: q.id ?? `saq-${i + 1}`,
      type: "saq" as const,
      prompt: q.prompt || q.question || `Short answer ${i + 1}`,
    })),
    ...essays.map((q, i) => ({
      ...q,
      id: q.id ?? `essay-${i + 1}`,
      type: "essay" as const,
      prompt: q.prompt || q.question || `Essay ${i + 1}`,
    })),
  ];

  return {
    exam: {
      ...generated,
      examId: saved.examId,
      examType: saved.testType || generated.examType || "exam",
      title: saved.title || generated.title,
      subject: saved.subject || generated.subject,
      year: saved.year || generated.year,
      questions,
    },
    answers: saved.answers || {},
    result: saved.result || null,
    attemptId: saved.attemptId,
    completedAt: saved.completedAt,
    generatedAt: saved.generatedAt,
  };
}

export function historyType(record: HistoryRecord): TestType {
  return getExamType(record.exam);
}

export function percentOf(result: ExamResult | null | undefined): number | null {
  if (!result) return null;
  const marks = Number(result.totalMarks) || 0;
  return marks ? (Number(result.totalScore) / marks) * 100 : null;
}

export interface Insights {
  subjects: { name: string; percentage: number }[];
  areas: { name: string; percentage: number }[];
  strengths: string[];
  weaknesses: string[];
  nextFocus: string;
  count: number;
}

/** performance.js renderInsights, as data. */
export function computeInsights(records: HistoryRecord[]): Insights | null {
  if (!records.length) return null;
  const subjectStats = new Map<string, { score: number; total: number }>();
  let mcqScore = 0;
  let mcqTotal = 0;
  let writtenScore = 0;
  let writtenTotal = 0;

  for (const record of records) {
    const result = record.result || ({} as Partial<ExamResult>);
    const subject = (record.exam?.subject as string) || "General Medicine";
    const current = subjectStats.get(subject) ?? { score: 0, total: 0 };
    current.score += Number(result.totalScore) || 0;
    current.total += Number(result.totalMarks) || 0;
    subjectStats.set(subject, current);
    mcqScore += Number(result.mcqScore) || 0;
    mcqTotal += Number(result.mcqTotal) || 0;
    writtenScore += Number(result.writtenScore) || 0;
    writtenTotal += Number(result.writtenTotal) || 0;
  }

  const subjects = [...subjectStats.entries()]
    .map(([name, stats]) => ({ name, percentage: stats.total ? (stats.score / stats.total) * 100 : 0 }))
    .sort((a, b) => b.percentage - a.percentage);
  const areas = [
    { name: "MCQs", percentage: mcqTotal ? (mcqScore / mcqTotal) * 100 : 0 },
    { name: "SAQs and essays", percentage: writtenTotal ? (writtenScore / writtenTotal) * 100 : 0 },
  ].sort((a, b) => b.percentage - a.percentage);

  const weakestSubject = subjects[subjects.length - 1];
  const weakestArea = areas[areas.length - 1]!;
  const strengths = [
    ...subjects.filter((s) => s.percentage >= 70).map((s) => s.name),
    ...areas.filter((a) => a.percentage >= 70).map((a) => a.name),
  ];
  const weaknesses = [
    ...subjects.filter((s) => s.percentage < 70).map((s) => s.name),
    ...areas.filter((a) => a.percentage < 70).map((a) => a.name),
  ];
  const nextFocus =
    weakestSubject && weakestSubject.percentage <= weakestArea.percentage
      ? `${weakestSubject.name} (${Math.round(weakestSubject.percentage)}%)`
      : `${weakestArea.name} (${Math.round(weakestArea.percentage)}%)`;

  return { subjects, areas, strengths, weaknesses, nextFocus, count: records.length };
}

/** Option answers may be stored as a letter; resolve to the option text for display (performance.js). */
export function resolveOptionAnswer(answer: unknown, options: unknown): string {
  const value = String(answer ?? "");
  if (!Array.isArray(options) || !/^[a-z]$/i.test(value.trim())) return value;
  const index = value.trim().toUpperCase().charCodeAt(0) - 65;
  return (options[index] as string | undefined) ?? value;
}
