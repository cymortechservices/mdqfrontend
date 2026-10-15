import assert from "node:assert/strict";
import { test } from "node:test";
import { PRICING, ASSESSMENTS, formatPrice } from "../src/lib/config";
import { checkStudentEmail, isStrongPassword, isKenyanMobile, cleanPhone, safeNextPath } from "../src/lib/validation";
import { normalizeExam, getExamType, formatClock, normalizeDisplayTitle } from "../src/lib/exam";
import { computeInsights, normalizeHistoryRecord, resolveOptionAnswer, summarize, normalizeDashRecord } from "../src/lib/records";
import { canonicalPathname } from "../src/lib/router";
import { EXPECTED_GENERATION_SECONDS } from "../src/features/exams/GeneratingOverlay";

test("pricing is kept as in the existing frontend (CAT 30, exam 99)", () => {
  assert.equal(PRICING.cat, 30);
  assert.equal(PRICING.exam, 99);
  assert.equal(formatPrice(99), "KSh 99");
  assert.equal(ASSESSMENTS.cat.minutes, 45);
  assert.equal(ASSESSMENTS.exam.minutes, 135);
});

test("generation overlay expectations: CAT 4 min, exam 8 min", () => {
  assert.equal(EXPECTED_GENERATION_SECONDS.cat, 240);
  assert.equal(EXPECTED_GENERATION_SECONDS.exam, 480);
});

test("student email domains and passwords follow the original rules", () => {
  assert.equal(checkStudentEmail("A.B@students.uonbi.ac.ke").valid, true);
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
