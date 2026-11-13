/**
 * Holds the assessment that is currently arriving from POST /api/generate-test (text/event-stream).
 *
 * It lives at module level on purpose: the exam room starts the request, then navigates to the exam
 * interface as soon as the first questions arrive, and the stream must keep running across that
 * navigation. The exam interface subscribes with `useLive()` and shows each question as it lands.
 *
 * Every update is also written to localStorage (key `currentExam`, flagged `streaming: true` until the
 * last batch) so the original storage contract still holds. A page reload kills the connection; the
 * interface then notices the leftover `streaming` flag and carries on with the questions it has.
 */
import { useSyncExternalStore } from "react";
import { saveCurrentExam } from "../../lib/storage";
import type { ExamPayload } from "../../types/api";
import { PROMISED_QUESTIONS, requestAssessment, type StreamProgress } from "./assessmentStream";

export type LiveStatus = "idle" | "streaming" | "done" | "error";

export interface LiveSnapshot {
  status: LiveStatus;
  exam: ExamPayload | null;
  /** Questions received so far. */
  received: number;
  /** Total announced by the server, if it did. */
  expected: number | null;
  error: string | null;
}

const IDLE: LiveSnapshot = { status: "idle", exam: null, received: 0, expected: null, error: null };
let snapshot: LiveSnapshot = IDLE;
let current: AbortController | null = null;
const listeners = new Set<() => void>();

const set = (next: LiveSnapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const countQuestions = (exam: ExamPayload | null | undefined): number => {
  if (!exam) return 0;
  const essay = Array.isArray(exam.essay) ? exam.essay.length : exam.essay ? 1 : 0;
  return (exam.mcqs?.length ?? exam.questions?.length ?? 0) + (exam.saqs?.length ?? 0) + essay;
};

/**
 * The exam clock starts the instant the FIRST question arrives and is owned by the stream, never read back from
 * storage (a leftover `startedAt` from an earlier exam would start the new clock already expired).
 */
let clockStartedAt = 0;

function persist(exam: ExamPayload) {
  saveCurrentExam({ ...exam, startedAt: clockStartedAt || Date.now() });
}

export function getLive(): LiveSnapshot {
  return snapshot;
}

export function subscribeLive(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLive(): LiveSnapshot {
  return useSyncExternalStore(subscribeLive, getLive, getLive);
}

/** Forget the finished/failed assessment (after it is submitted or abandoned). */
export function resetLive() {
  current?.abort();
  current = null;
  set(IDLE);
}

/**
 * Starts the request. Resolves as soon as the FIRST questions arrive (or with the whole exam when the
 * server answers with plain JSON); the stream then keeps filling `useLive()` until it ends.
 * `signal` only cancels the wait for the first questions; once the exam is open, leaving a page never kills the stream.
 */
export function beginLive(
  form: FormData,
  opts: { signal: AbortSignal; fallbackType: string; defaults?: Partial<ExamPayload>; onProgress: (progress: StreamProgress) => void },
): Promise<ExamPayload> {
  current?.abort();
  const controller = new AbortController();
  current = controller;
  set({ ...IDLE, status: "streaming" });
  clockStartedAt = 0;

  return new Promise<ExamPayload>((resolve, reject) => {
    let ready = false;
    const abortEarly = () => controller.abort();
    if (opts.signal.aborted) abortEarly();
    opts.signal.addEventListener("abort", abortEarly);
    const markReady = (exam: ExamPayload) => {
      if (ready) return;
      ready = true;
      opts.signal.removeEventListener("abort", abortEarly);
      resolve(exam);
    };

    requestAssessment(form, {
      signal: controller.signal,
      fallbackType: opts.fallbackType,
      defaults: opts.defaults,
      onProgress: opts.onProgress,
      onPartial: (exam, progress) => {
        if (controller !== current) return;
        if (!clockStartedAt) clockStartedAt = Date.now(); // first question is here: the clock starts now
        exam = { ...exam, startedAt: clockStartedAt };
        set({ status: "streaming", exam, received: progress.received, expected: progress.expected ?? PROMISED_QUESTIONS[opts.fallbackType] ?? null, error: null });
        if (!ready) {
          // The room has already stored nothing yet: write it before anyone reads it back.
          persist(exam);
          markReady(exam);
        } else persist(exam);
      },
    })
      .then((final) => {
        if (controller !== current) return;
        const { streaming: _streaming, ...clean } = final as ExamPayload & { streaming?: unknown };
        if (!clockStartedAt) clockStartedAt = Date.now();
        const exam: ExamPayload = { ...clean, startedAt: clockStartedAt };
        const received = countQuestions(exam);
        persist(exam);
        set({ status: "done", exam, received, expected: received, error: null });
        markReady(exam);
      })
      .catch((error: unknown) => {
        if (controller !== current) return;
        const message = error instanceof Error ? error.message : "The connection was interrupted.";
        if (!ready) {
          opts.signal.removeEventListener("abort", abortEarly);
          set(IDLE);
          reject(error);
          return;
        }
        // Already on screen: keep what arrived so the student can carry on with it.
        const exam = snapshot.exam;
        if (exam) {
          const { streaming: _streaming, ...clean } = exam as ExamPayload & { streaming?: unknown };
          // `interrupted` lets a reloaded page know the questions it finds are all that will ever arrive.
          persist({ ...clean, interrupted: true });
          set({ ...snapshot, status: "error", exam: { ...clean, startedAt: clockStartedAt }, error: message });
        } else set({ ...snapshot, status: "error", error: message });
      });
  });
}
