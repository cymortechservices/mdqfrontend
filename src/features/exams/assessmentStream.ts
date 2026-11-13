/**
 * Reads POST /api/generate-test when the backend streams it as `text/event-stream`, and still
 * accepts the original single JSON response.
 *
 * The exact event schema is owned by the backend, so the parser is deliberately tolerant. Per event
 * (JSON in `data:`; the event name comes from `event:` or a `type`/`event` field):
 *   - batches    arrays under `mcqs` / `saqs` / `essay` / `questions` (top level, or inside `batch` / `data`);
 *                a `questions` array is routed by the event/section name (saq, essay) and defaults to MCQs.
 *                A single object under `question` (with `type`) is also accepted. Duplicates (same id) are ignored.
 *   - metadata   examId, title, subject, year, examType, requiresPaymentConfirmation … (top level or inside `meta`)
 *   - progress   numeric `total` / `expected` / `totalQuestions` (used only to size the progress bar)
 *   - completion event `done` / `complete` / `end` / `final`, or `done: true`; else a normal close of the stream once
 *                every announced question has arrived. An `exam` object is merged like a batch, never taken as "finished".
 *   - failure    event `error` or an `error` / `message` string
 * Nothing is ever fabricated: an assessment is only returned once the stream says it is complete.
 */
import { ApiError, NETWORK_ERROR_MESSAGE, apiUrl } from "../../lib/api";
import type { ExamPayload, RawEssay, RawMcq, RawSaq } from "../../types/api";

export interface StreamProgress {
  /** Questions received so far (MCQs + SAQs + essay). */
  received: number;
  /** Total announced by the server, if any. */
  expected: number | null;
}

export interface StreamState {
  meta: Partial<ExamPayload>;
  mcqs: RawMcq[];
  saqs: RawSaq[];
  essay: RawEssay[];
  expected: number | null;
  /** The server explicitly said the assessment is complete. */
  done: boolean;
  /** The connection closed normally (no network error). */
  ended: boolean;
  error: string | null;
}

export function newStreamState(defaults: Partial<ExamPayload> = {}): StreamState {
  return { meta: { ...defaults }, mcqs: [], saqs: [], essay: [], expected: null, done: false, ended: false, error: null };
}

export const receivedCount = (state: StreamState): number => state.mcqs.length + state.saqs.length + state.essay.length;

/** What MDQ promises per assessment (50 MCQs; 90 MCQs + 3 SAQs + 1 essay). The stream must reach this unless the server announced another total. */
export const PROMISED_QUESTIONS: Record<string, number> = { cat: 50, exam: 94 };

const META_KEYS = ["examId", "title", "examTitle", "subject", "course", "module", "year", "studyYear", "yearOfStudy", "examType", "testType", "type", "requiresPaymentConfirmation"] as const;
const DONE_EVENTS = new Set(["done", "complete", "completed", "end", "final", "finished"]);

const isObject = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asList = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : isObject(value) ? [value as T] : []);

function addUnique<T extends { id?: string | number }>(target: T[], items: T[]) {
  for (const item of items) {
    if (!isObject(item)) continue;
    if (item.id !== undefined && target.some((existing) => existing.id === item.id)) continue;
    target.push(item);
  }
}

/** Pure reducer: fold one parsed SSE message into the state. Exported for tests. */
export function applyMessage(state: StreamState, eventName: string, message: unknown): void {
  if (!isObject(message)) return;
  const event = (eventName || String(message.type ?? message.event ?? "")).toLowerCase();

  // An error is only remembered, never acted on here: servers also send non-fatal notices (a chunk retry, say)
  // and keep streaming afterwards. If more questions arrive the error is forgotten; if the stream then ends
  // short, the remembered text is what the student sees. The connection is never closed because of one.
  const errorText = typeof message.error === "string" ? message.error.trim() : "";
  const isError = event === "error" || errorText !== "";
  if (isError) state.error = errorText || String(message.message || "The assessment could not be set up.");
  const before = receivedCount(state);

  for (const source of [message, message.meta, message.data].filter(isObject)) {
    for (const key of META_KEYS) {
      if (key === "type") continue; // `type` is an event discriminator here, not exam metadata
      if (source[key] !== undefined && source[key] !== null) (state.meta as Record<string, unknown>)[key] = source[key];
    }
    for (const key of ["total", "expected", "totalQuestions", "expectedQuestions", "plannedQuestionCount", "plannedTotal", "totalPlanned"]) {
      const value = Number(source[key]);
      if (Number.isFinite(value) && value > 0) state.expected = Math.max(state.expected ?? 0, value);
    }
  }

  for (const source of [message, message.batch, message.data].filter(isObject)) {
    addUnique(state.mcqs, asList<RawMcq>(source.mcqs));
    addUnique(state.saqs, asList<RawSaq>(source.saqs));
    addUnique(state.essay, asList<RawEssay>(source.essay));
    const route = `${event} ${String(source.section ?? source.kind ?? "")}`.toLowerCase();
    const generic = asList<RawMcq & RawSaq & RawEssay>(source.questions ?? source.question);
    if (generic.length) {
      if (route.includes("essay")) addUnique(state.essay, generic);
      else if (route.includes("saq")) addUnique(state.saqs, generic);
      else addUnique(state.mcqs, generic);
    }
  }

  // An `exam` object is just another batch (possibly the whole exam so far): merge it, never treat it as "finished".
  if (isObject(message.exam)) {
    const inner = message.exam as Record<string, any>;
    addUnique(state.mcqs, asList<RawMcq>(inner.mcqs ?? inner.questions));
    addUnique(state.saqs, asList<RawSaq>(inner.saqs));
    addUnique(state.essay, asList<RawEssay>(inner.essay));
    for (const key of META_KEYS) if (key !== "type" && inner[key] !== undefined && inner[key] !== null) (state.meta as Record<string, unknown>)[key] = inner[key];
  }
  if (DONE_EVENTS.has(event) || message.done === true) state.done = true;
  if (!isError && receivedCount(state) > before) state.error = null;
}

/**
 * Build the finished exam, or throw a plain-language error. Exported for tests.
 * Complete means: every question is in (the announced total, else what MDQ promises for that test type) AND the
 * server said it is done or closed the stream normally. A short stream is an interruption, whatever else was said.
 */
export function finishStream(state: StreamState, fallbackType: string): ExamPayload {
  const received = receivedCount(state);
  const target = state.expected ?? PROMISED_QUESTIONS[fallbackType] ?? null;
  const short = target !== null && received < target;
  const complete = received > 0 && !short && (state.done || state.ended);
  if (!complete) {
    if (state.error) throw new Error(state.error);
    throw new Error(
      received > 0
        ? `Only ${received} of ${target ?? "all"} questions arrived before the connection ended.`
        : "The assessment ended before any questions were ready. Please try again.",
    );
  }
  const exam: ExamPayload = {
    ...state.meta,
    mcqs: state.mcqs,
    ...(state.saqs.length ? { saqs: state.saqs } : {}),
    ...(state.essay.length ? { essay: state.essay } : {}),
  };
  if (exam.examId === undefined || exam.examId === null || exam.examId === "") {
    throw new Error("The assessment finished without an id, so it cannot be submitted. Please try again.");
  }
  if (!exam.examType && !exam.testType) exam.examType = fallbackType;
  return exam;
}

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incremental SSE/NDJSON line parser. Feed it the whole unread buffer; it returns the complete events and
 * the unconsumed remainder (an unfinished last line). Besides standard `event:`/`data:` frames separated by a
 * blank line, it also delivers a `data:` line (or a bare JSON line) the moment it is a complete JSON value,
 * so servers that forget the blank line between events still stream live. Exported for tests.
 */
export function drainEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() ?? "";
  const events: SseEvent[] = [];
  let name = "";
  let pending: string[] = [];
  const flush = () => {
    if (pending.length) events.push({ event: name, data: pending.join("\n") });
    else if (name) events.push({ event: name, data: "" });
    pending = [];
    name = "";
  };
  const isJson = (text: string) => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };
  for (const line of lines) {
    if (line === "") {
      flush();
    } else if (line.startsWith(":")) {
      continue;
    } else if (line.startsWith("event:")) {
      if (pending.length) flush();
      name = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      const payload = line.slice(5).replace(/^ /, "");
      if (!pending.length && (isJson(payload) || payload === "[DONE]")) {
        events.push({ event: name, data: payload }); // complete on its own: deliver now
        // keep `name` until the blank line, like the spec says
      } else pending.push(payload);
    } else if (line.trimStart().startsWith("{") && isJson(line)) {
      events.push({ event: name, data: line }); // bare NDJSON line
    }
  }
  // Lines of an unfinished frame (no blank line yet) stay buffered by giving them back.
  const unfinished = pending.length || name ? [name ? `event: ${name}` : "", ...pending.map((p) => `data: ${p}`)].filter(Boolean).join("\n") + "\n" : "";
  return { events, rest: unfinished + rest };
}

/** The exam as received so far (questions that have arrived, flagged `streaming`). Exported for tests. */
export function partialExam(state: StreamState, fallbackType: string): ExamPayload {
  const exam: ExamPayload = {
    ...state.meta,
    mcqs: state.mcqs,
    ...(state.saqs.length ? { saqs: state.saqs } : {}),
    ...(state.essay.length ? { essay: state.essay } : {}),
    streaming: true,
  };
  if (!exam.examType && !exam.testType) exam.examType = fallbackType;
  return exam;
}

export async function requestAssessment(
  form: FormData,
  opts: {
    signal: AbortSignal;
    fallbackType: string;
    onProgress: (progress: StreamProgress) => void;
    /** Called after every batch with everything received so far, so the exam can be shown while the rest arrives. */
    onPartial?: (exam: ExamPayload, progress: StreamProgress) => void;
    /** Used when the server does not send them (the year and subject the student chose). */
    defaults?: Partial<ExamPayload>;
  },
): Promise<ExamPayload> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/generate-test"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "text/event-stream, application/json;q=0.9" },
      body: form,
      signal: opts.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || !contentType.includes("text/event-stream") || !response.body) {
    const text = await response.text();
    let data: Record<string, any> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(`The server returned an invalid response (HTTP ${response.status}).`, response.status);
    }
    if (!response.ok) throw new Error(data.error || `HTTP Error status:${response.status}`);
    const exam = { ...(data as ExamPayload) };
    exam.year = exam.year || opts.defaults?.year;
    exam.subject = exam.subject || opts.defaults?.subject;
    opts.onProgress({ received: 1, expected: 1 });
    return exam;
  }

  const state = newStreamState(opts.defaults);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const target = () => state.expected ?? PROMISED_QUESTIONS[opts.fallbackType] ?? null;
  const isComplete = () => state.done && !(target() !== null && receivedCount(state) < target()!);

  const handle = (events: SseEvent[]) => {
    for (const { event, data } of events) {
      try {
        if (data === "[DONE]") {
          state.done = true;
          continue;
        }
        applyMessage(state, event, data ? JSON.parse(data) : {});
      } catch (error) {
        // One odd event must never stop the stream: skip it and keep reading.
        console.warn("[assessment stream] skipped an unreadable event", event, error);
      }
    }
    const progress = { received: receivedCount(state), expected: state.expected };
    try {
      opts.onProgress(progress);
      if (progress.received > 0) opts.onPartial?.(partialExam(state, opts.fallbackType), progress);
    } catch (error) {
      console.warn("[assessment stream] could not update the exam on screen", error);
    }
  };

  // After the server says "done" but is still short of the target, wait this long for stragglers, then stop.
  const GRACE_AFTER_DONE_MS = 15000;
  const readNext = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    if (!state.done) return reader.read();
    let timer = 0;
    const idle = new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
      timer = window.setTimeout(() => resolve({ done: true, value: undefined }), GRACE_AFTER_DONE_MS);
    });
    try {
      return await Promise.race([reader.read(), idle]);
    } finally {
      window.clearTimeout(timer);
    }
  };

  try {
    for (;;) {
      const { value, done } = await readNext();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const drained = drainEvents(buffer);
      buffer = drained.rest;
      handle(drained.events);
      if (isComplete()) break; // everything is in; no need to wait for the server to hang up
    }
    buffer += decoder.decode();
    if (buffer.trim()) handle(drainEvents(`${buffer}\n\n`).events);
    state.ended = true; // the server closed the stream (or finished it)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if (!isComplete()) {
      const have = receivedCount(state);
      throw new ApiError(
        have > 0
          ? `The connection dropped after ${have} questions. Please try again.`
          : "The connection was interrupted while your assessment was being set up. Please try again.",
        0,
      );
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return finishStream(state, opts.fallbackType);
}
