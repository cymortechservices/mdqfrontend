/**
 * Exam data normalisation, ported from the original examinterface.js.
 * The stored `currentExam` object is never mutated here; this only builds a view model.
 */
import type { ExamPayload, RawEssay, RawMcq, RawSaq, RawSubQuestion, SourceEvidence } from "../types/api";
import { ASSESSMENTS, type TestType } from "./config";

export type QuestionType = "mcq" | "saq" | "essay";

export interface ViewQuestion {
  /** Stable key used for answers (string form of the backend id). */
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  subQuestions: RawSubQuestion[];
  totalMarks?: number | string;
  sourceEvidence?: SourceEvidence[];
}

export interface ViewSection {
  title: string;
  type: QuestionType;
  questions: ViewQuestion[];
}

export interface ViewExam {
  examId?: string | number;
  title: string;
  subject: string;
  year: string;
  examType: TestType;
  requiresPaymentConfirmation: boolean;
  durationMinutes: number;
  sections: ViewSection[];
  questions: ViewQuestion[];
}

export function getExamType(exam: Pick<ExamPayload, "examType" | "testType" | "type"> | undefined | null): TestType {
  const raw = String(exam?.examType || exam?.testType || exam?.type || "exam")
    .trim()
    .toLowerCase();
  return raw === "cat" ? "cat" : "exam";
}

/** Original title clean-up: "X MCQ Assessment" → "X CAT" / "X Exam". */
export function normalizeDisplayTitle(title: unknown, examType: string = "exam"): string {
  const rawTitle = typeof title === "string" ? title.trim() : "";
  const type = String(examType).toLowerCase();
  if (!rawTitle) return type === "cat" ? "CAT" : "Exam";

  const normalized = rawTitle.replace(/\s+/g, " ").trim();
  if (normalized.toLowerCase() === "assessment") return normalized;

  const generic = /^(.*?)(?:\s+MCQ)?\s+Assessment$/i.exec(normalized);
  if (generic) {
    const cleaned = (generic[1] ?? "").trim();
    if (cleaned) return `${cleaned} ${type === "cat" ? "CAT" : "Exam"}`;
  }
  return normalized;
}

function asArray<T>(value: T[] | T | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function mcqView(items: RawMcq[]): ViewQuestion[] {
  return items.map((item, index) => ({
    id: String(item?.id ?? `mcq-${index + 1}`),
    type: "mcq" as const,
    prompt: item?.question || item?.prompt || `Question ${index + 1}`,
    options: Array.isArray(item?.options) ? item.options.map((option) => String(option)) : [],
    subQuestions: [],
    sourceEvidence: item?.sourceEvidence,
  }));
}

function saqView(items: RawSaq[]): ViewQuestion[] {
  return items.map((item, index) => ({
    id: String(item?.id ?? `saq-${index + 1}`),
    type: "saq" as const,
    prompt: item?.question || item?.prompt || `Short answer question ${index + 1}`,
    options: [],
    subQuestions: Array.isArray(item?.subQuestions) ? item.subQuestions : [],
    totalMarks: item?.totalMarks || undefined,
    sourceEvidence: item?.sourceEvidence,
  }));
}

function essayView(items: RawEssay[]): ViewQuestion[] {
  return items.map((item, index) => ({
    id: String(item?.id ?? `essay-${index + 1}`),
    type: "essay" as const,
    prompt: item?.question || item?.prompt || `Essay question ${index + 1}`,
    options: [],
    subQuestions: [],
    sourceEvidence: item?.sourceEvidence,
  }));
}

export function normalizeExam(exam: ExamPayload): ViewExam {
  const examType = getExamType(exam);
  const mcqs = mcqView(asArray<RawMcq>((exam.mcqs as RawMcq[]) || (exam.questions as RawMcq[]) || []));
  const saqs = saqView(asArray<RawSaq>(exam.saqs));
  const essays = essayView(asArray<RawEssay>(exam.essay));

  const sections: ViewSection[] =
    examType === "cat"
      ? [{ title: "Multiple choice questions", type: "mcq", questions: mcqs }]
      : (
          [
            { title: "Multiple choice questions", type: "mcq", questions: mcqs },
            { title: "Short answer questions", type: "saq", questions: saqs },
            { title: "Essay question", type: "essay", questions: essays },
          ] as ViewSection[]
        ).filter((section) => section.questions.length > 0);

  return {
    examId: exam.examId,
    title: normalizeDisplayTitle(exam.title || exam.examTitle, examType),
    subject: String(exam.subject || exam.course || exam.module || "General Medicine"),
    year: String(exam.year || exam.studyYear || exam.yearOfStudy || "N/A"),
    examType,
    requiresPaymentConfirmation: Boolean(exam.requiresPaymentConfirmation),
    durationMinutes: ASSESSMENTS[examType].minutes,
    sections,
    questions: sections.flatMap((section) => section.questions),
  };
}

export function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} hour${hours === 1 ? "" : "s"}${rest ? ` ${rest} minutes` : ""}`;
  }
  return `${minutes} minutes`;
}

export function formatClock(totalSeconds: number, withHours: boolean): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return withHours ? `${String(hours).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function hasAnswer(answer: unknown): boolean {
  if (answer == null) return false;
  if (Array.isArray(answer)) return answer.some(hasAnswer);
  if (typeof answer === "object") return Object.values(answer as object).some(hasAnswer);
  return String(answer).trim().length > 0;
}

/** Instructions shown on the exam screen (copied from the original). */
export function instructionsFor(type: TestType): string[] {
  return type === "cat"
    ? [
        "Answer all questions.",
        "For each multiple-choice question, select one best answer.",
        "Review your responses before submitting.",
        "Do not refresh this tab. Your exam timer continues running and will not reset.",
      ]
    : [
        "Answer all questions in every section.",
        "For each multiple-choice question, select one best answer.",
        "Enter your short-answer and essay responses in the spaces provided.",
        "Review your responses and manage your time carefully.",
        "Do not refresh this tab. Your exam timer continues running and will not reset.",
      ];
}

/** Letter label for an option index (A, B, C…). */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
