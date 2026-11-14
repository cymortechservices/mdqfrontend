import assert from "node:assert/strict";
import { test } from "node:test";
import { PRICING, ASSESSMENTS, formatPrice } from "../src/lib/config";
import { checkStudentEmail, isStrongPassword, isKenyanMobile, cleanPhone, safeNextPath } from "../src/lib/validation";
import { normalizeExam, getExamType, formatClock, normalizeDisplayTitle } from "../src/lib/exam";
import { computeInsights, normalizeHistoryRecord, resolveOptionAnswer, summarize, normalizeDashRecord } from "../src/lib/records";
import { canonicalPathname } from "../src/lib/router";
import { PROMISED_QUESTIONS, applyMessage, drainEvents, finishStream, newStreamState, partialExam, receivedCount } from "../src/features/exams/assessmentStream";

test("pricing is kept as in the existing frontend (CAT 30, exam 79)", () => {
  assert.equal(PRICING.cat, 30);
  assert.equal(PRICING.exam, 79);
  assert.equal(formatPrice(79), "KSh 79");
  assert.equal(ASSESSMENTS.cat.minutes, 45);
  assert.equal(ASSESSMENTS.exam.minutes, 135);
});

test("assessment stream: batches accumulate, duplicates are ignored, completion yields an exam", () => {
  const raw = 'event: meta\ndata: {"examId":"e1","title":"T","total":3}\n\nevent: batch\ndata: {"mcqs":[{"id":"mcq1"},{"id":"mcq2"}]}\n\nevent: batch\ndata: {"mcqs":[{"id":"mcq2"},{"id":"mcq3"}]}\n\nevent: done\ndata: {}\n\n';
  const { events, rest } = drainEvents(raw);
  assert.equal(rest, "");
  const state = newStreamState();
  for (const e of events) applyMessage(state, e.event, JSON.parse(e.data || "{}"));
  assert.equal(receivedCount(state), 3);
  assert.equal(state.expected, 3);
  const exam = finishStream(state, "quiz");
  assert.equal(exam.examId, "e1");
  assert.equal(exam.mcqs?.length, 3);
});

test("assessment stream: partial events stay buffered; an early end or error never fabricates an exam", () => {
  assert.equal(drainEvents('event: batch\ndata: {"mcqs"').events.length, 0);
  const cut = newStreamState();
  applyMessage(cut, "meta", { examId: "e1" });
  applyMessage(cut, "batch", { mcqs: [{ id: "a" }] });
  assert.throws(() => finishStream(cut, "quiz"), /ended|arrived/);
  const failed = newStreamState();
  applyMessage(failed, "error", { error: "Could not set up the assessment." });
  assert.throws(() => finishStream(failed, "quiz"), /Could not set up/);
});

test("student email domains and passwords follow the original rules", () => {
  assert.equal(checkStudentEmail("A.B@students.uonbi.ac.ke").valid, true);
  assert.equal(checkStudentEmail("student@jkuat.ac.ke").valid, true);
  assert.equal(checkStudentEmail("a@uni.edu").valid, true);
  assert.equal(checkStudentEmail("a@gmail.com").valid, false);
  assert.equal(isStrongPassword("Abcdef1#"), true);
  assert.equal(isStrongPassword("abcdef"), false);
});

test("M-Pesa numbers and redirect targets", () => {
  assert.equal(isKenyanMobile("0712345678"), true);
  assert.equal(isKenyanMobile("12345"), false);
  assert.match(cleanPhone("0712 345 678"), /^2547\d{8}$|^07\d{8}$/);
  assert.equal(safeNextPath("https://evil.example"), null);
  assert.equal(safeNextPath("/performance"), "/performance");
});

test("legacy URLs are canonicalised", () => {
  assert.equal(canonicalPathname("/pages/login.html"), "/login");
  assert.equal(canonicalPathname("/portal.html"), "/portal");
  assert.equal(canonicalPathname("/index.html"), "/");
  assert.equal(canonicalPathname("/privacy-policy/"), "/privacy-policy");
});

test("exam normalisation builds sections and durations", () => {
  const cat = normalizeExam({ examType: "cat", mcqs: [{ id: 1, question: "Q", options: ["a", "b"] }] });
  assert.equal(cat.durationMinutes, 45);
  assert.equal(cat.sections.length, 1);
  const exam = normalizeExam({ examType: "exam", mcqs: [{ id: 1 }], saqs: [{ id: 2 }], essay: [{ id: 3 }] });
  assert.equal(exam.durationMinutes, 135);
  assert.equal(exam.questions.length, 3);
  assert.equal(getExamType({ testType: "CAT" }), "cat");
  assert.equal(normalizeDisplayTitle("Anatomy MCQ Assessment", "cat"), "Anatomy CAT");
  assert.equal(formatClock(3725, true), "01:02:05");
});

test("performance maths", () => {
  const rec = normalizeHistoryRecord({
    testType: "cat", subject: "Anatomy", completedAt: "2026-10-10T00:00:00Z",
    exam: { mcqs: [{ id: "m1", options: ["x", "y"] }] },
    result: { totalScore: 7, totalMarks: 10, mcqScore: 7, mcqTotal: 10 },
  });
  const insights = computeInsights([rec]);
  assert.equal(insights?.strengths.includes("Anatomy"), true);
  assert.equal(resolveOptionAnswer("B", ["x", "y"]), "y");
  const s = summarize([normalizeDashRecord({ completedAt: "2026-10-10T00:00:00Z", result: { totalScore: 7, totalMarks: 10 }, answers: { a: "1" } })]);
  assert.equal(s.readiness, 70);
});

test("assessment stream: a partial exam is usable before the stream ends and carries the chosen year and subject", () => {
  const state = newStreamState({ year: "3", subject: "Pharmacology" });
  applyMessage(state, "meta", { examId: "e9", total: 50 });
  applyMessage(state, "batch", { mcqs: [{ id: "m1" }, { id: "m2" }] });
  const partial = partialExam(state, "cat");
  assert.equal(partial.mcqs?.length, 2);
  assert.equal(partial.streaming, true);
  assert.equal(partial.year, "3");
  assert.equal(partial.subject, "Pharmacology");
  assert.equal(state.expected, 50);
  applyMessage(state, "batch", { mcqs: [{ id: "m3" }] });
  applyMessage(state, "done", { done: true });
  state.expected = 3; // (the server later settles on 3 in this example)
  const finished = finishStream(state, "quiz");
  assert.equal(finished.mcqs?.length, 3);
  assert.equal(finished.streaming, undefined);
});

test("assessment stream: an `exam` object is merged as a batch, never treated as the finished exam", () => {
  const state = newStreamState();
  applyMessage(state, "batch", { exam: { examId: "e1", mcqs: [{ id: "a" }, { id: "b" }] } });
  applyMessage(state, "batch", { exam: { examId: "e1", mcqs: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] } });
  assert.equal(receivedCount(state), 4);
  assert.throws(() => finishStream(state, "quiz"), /ended|arrived/); // no done signal and no clean end yet
  state.ended = true;
  assert.equal(finishStream(state, "quiz").mcqs?.length, 4);
});

test("assessment stream: a normal close counts as complete only when every announced question arrived", () => {
  const short = newStreamState();
  applyMessage(short, "meta", { examId: "e1", total: 5 });
  applyMessage(short, "batch", { mcqs: [{ id: "a" }, { id: "b" }] });
  short.ended = true;
  assert.throws(() => finishStream(short, "quiz"), /ended|arrived/);
  const full = newStreamState();
  applyMessage(full, "meta", { examId: "e1", total: 2 });
  applyMessage(full, "batch", { mcqs: [{ id: "a" }, { id: "b" }] });
  full.ended = true;
  assert.equal(finishStream(full, "quiz").mcqs?.length, 2);
});

test("assessment stream: an empty error field is not a failure; a real one is", () => {
  const state = newStreamState();
  applyMessage(state, "batch", { error: "", mcqs: [{ id: "a" }] });
  assert.equal(state.error, null);
  assert.equal(receivedCount(state), 1);
  applyMessage(state, "batch", { error: "Model overloaded" });
  assert.equal(state.error, "Model overloaded");
});

test("assessment stream: events are delivered live even when the server omits the blank line between them", () => {
  const { events, rest } = drainEvents('data: {"mcqs":[{"id":"a"}]}\ndata: {"mcqs":[{"id":"b"}]}\n{"mcqs":[{"id":"c"}]}\ndata: {"mc');
  assert.equal(events.length, 3);
  assert.equal(rest, 'data: {"mc');
});

test("assessment stream: an error notice mid-stream (a chunk retry) never stops the stream or loses questions", () => {
  const state = newStreamState();
  applyMessage(state, "meta", { examId: "e1", plannedQuestionCount: 4 });
  applyMessage(state, "batch", { mcqs: [{ id: "a" }, { id: "b" }] });
  applyMessage(state, "chunk_retry", { error: "chunk 2 failed, retrying", attempt: 1 });
  assert.equal(state.error, "chunk 2 failed, retrying");
  assert.equal(receivedCount(state), 2);
  applyMessage(state, "batch", { mcqs: [{ id: "c" }, { id: "d" }] });
  assert.equal(state.error, null); // the retry worked, so the notice is forgotten
  state.ended = true;
  assert.equal(finishStream(state, "cat").mcqs?.length, 4);
});

test("assessment stream: the server's planned total is the target, and a short stream is never complete", () => {
  const state = newStreamState();
  applyMessage(state, "progress", { examId: "e1", plannedQuestionCount: 50, publishedQuestionCount: 15 });
  assert.equal(state.expected, 50);
  applyMessage(state, "batch", { mcqs: Array.from({ length: 15 }, (_, i) => ({ id: `q${i}` })) });
  state.done = true;
  state.ended = true;
  assert.throws(() => finishStream(state, "cat"), /Only 15 of 50/);
  applyMessage(state, "batch", { mcqs: Array.from({ length: 35 }, (_, i) => ({ id: `r${i}` })) });
  assert.equal(finishStream(state, "cat").mcqs?.length, 50);
});

test("assessment stream: without an announced total, MDQ's promised size is still required", () => {
  assert.equal(PROMISED_QUESTIONS.cat, 50);
  const state = newStreamState();
  applyMessage(state, "meta", { examId: "e1" });
  applyMessage(state, "batch", { mcqs: Array.from({ length: 15 }, (_, i) => ({ id: `q${i}` })) });
  state.ended = true; // a proxy closing the connection cleanly after the first chunk
  assert.throws(() => finishStream(state, "cat"), /Only 15 of 50/);
});
