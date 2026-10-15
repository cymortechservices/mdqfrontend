/**
 * localStorage access, wrapped so private-mode / blocked storage never crashes the app.
 *
 * Keys that existed in the original frontend and are kept for compatibility:
 *   currentExam            – JSON of the exam being taken (response of POST /api/generate-test)
 *   currentExamAnswers     – JSON map { [questionId]: answer } (draft while taking the exam)
 *   currentExamResult      – JSON { exam, answers, result, completedAt } of the last submission
 *   mdqPendingPayment:<t>  – checkoutRequestId of an M-Pesa payment not yet consumed (t = cat | exam)
 *
 * New keys introduced by the redesign (all optional, UI-only):
 *   currentExamAnswersFor  – examId the stored draft belongs to (prevents restoring answers into another exam)
 *   mdq.sidebar            – "collapsed" | "expanded" (desktop sidebar preference)
 */
import type { ExamPayload } from "../types/api";

export const KEYS = {
  currentExam: "currentExam",
  currentExamAnswers: "currentExamAnswers",
  currentExamAnswersFor: "currentExamAnswersFor",
  currentExamResult: "currentExamResult",
  sidebar: "mdq.sidebar",
} as const;

export function pendingPaymentKey(testType: string): string {
  return `mdqPendingPayment:${String(testType).toLowerCase()}`;
}

export function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function readJson<T>(key: string): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readCurrentExam(): ExamPayload | null {
  const exam = readJson<ExamPayload>(KEYS.currentExam);
  return exam && typeof exam === "object" ? exam : null;
}

export function saveCurrentExam(exam: ExamPayload): void {
  safeSet(KEYS.currentExam, JSON.stringify(exam));
}

/** Remove any in-progress answer draft (used whenever a different exam is opened). */
export function clearAnswerDraft(): void {
  safeRemove(KEYS.currentExamAnswers);
  safeRemove(KEYS.currentExamAnswersFor);
}

export function readAnswerDraft(examId: string | number | undefined): Record<string, string> {
  if (examId === undefined || examId === null) return {};
  if (safeGet(KEYS.currentExamAnswersFor) !== String(examId)) return {};
  const draft = readJson<Record<string, unknown>>(KEYS.currentExamAnswers);
  if (!draft || typeof draft !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function saveAnswerDraft(examId: string | number | undefined, answers: Record<string, string>): void {
  if (examId === undefined || examId === null) return;
  safeSet(KEYS.currentExamAnswers, JSON.stringify(answers));
  safeSet(KEYS.currentExamAnswersFor, String(examId));
}
