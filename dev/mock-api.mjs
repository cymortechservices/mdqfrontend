// DEV-ONLY mock of the MDQ backend contracts, so the UI can be explored and end-to-end tested
// without the real service. It is NOT part of the production bundle (never imported by src/).
// All names, scores and questions below are obviously fake fixtures for local testing.
import { randomUUID } from "node:crypto";

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
const readRaw = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("latin1")));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeMcqs(count, prefix = "mcq") {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    question: `[Mock] Question ${i + 1}: which option is the best answer?`,
    options: ["Option A text", "Option B text", "Option C text", "Option D text"],
    correctAnswer: "B",
    explanation: "Mock explanation: option B is correct in this fixture.",
    sourceEvidence: i === 0 ? [{ title: "Mock textbook", reference: "ch. 1", quote: "A fixture passage for UI testing." }] : [],
  }));
}

function makeExam(type, subject = "Pharmacology", year = "3") {
  const base = { examId: randomUUID(), examType: type, title: `${subject} ${type === "cat" ? "CAT" : "Exam"}`, subject, year };
  if (type === "cat") return { ...base, mcqs: makeMcqs(10) };
  return {
    ...base,
    mcqs: makeMcqs(6),
    saqs: [{ id: "saq-1", question: "[Mock] Short answer question", totalMarks: 10, subQuestions: [{ question: "Define the term", marks: 4 }, { question: "Give two examples", marks: 6 }] }],
    essay: [{ id: "essay-1", question: "[Mock] Essay question: discuss." }],
  };
}

export function createMockApi({ generateMs = Number(process.env.MOCK_GENERATE_MS ?? 2500) } = {}) {
  const sessions = new Set();
  const state = {
    user: { id: 1, studentEmail: "demo.student@students.uonbi.ac.ke", whatsAppNumber: "+254700000000", createdAt: "2026-09-20T08:00:00Z", emailVerified: true },
    trials: { cat: true, exam: true },
    exams: [],
    payments: new Map(),
    shares: new Map(),
    users: [
      { id: 1, displayName: "", studentEmail: "demo.student@students.uonbi.ac.ke", whatsAppNumber: "+254700000000", emailVerified: true, createdAt: "2026-09-20T08:00:00Z", assessments: [] },
      { id: 2, displayName: "Mock Person", studentEmail: "mock.person@students.jkuat.ac.ke", whatsAppNumber: "+254711111111", emailVerified: false, createdAt: "2026-10-12T10:00:00Z", assessments: [{ testType: "cat", title: "Mock CAT", subject: "Anatomy", year: 2, completedAt: "2026-10-13T10:00:00Z", score: 6, totalMarks: 10 }] },
    ],
  };
  const sid = (req) => /(?:^|;\s*)mdq_mock=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  const authed = (req) => sessions.has(sid(req));
  const isAdmin = (req) => authed(req) && sid(req).startsWith("admin");
  const setCookie = (value) => ({ "Set-Cookie": `mdq_mock=${value}; Path=/; HttpOnly; SameSite=Lax${value ? "" : "; Max-Age=0"}` });

  // seed history
  const seedCat = { ...makeExam("cat", "Anatomy", "2"), examId: "seed-cat" };
  state.exams.push({ examId: seedCat.examId, attemptId: "attempt-1", testType: "cat", title: seedCat.title, subject: "Anatomy", year: "2", exam: seedCat, answers: Object.fromEntries(seedCat.mcqs.map((m, i) => [m.id, i % 3 ? "Option B text" : "Option A text"])), result: { totalScore: 7, totalMarks: 10, mcqScore: 7, mcqTotal: 10, writtenScore: 0, writtenTotal: 0, mcqResults: seedCat.mcqs.map((m, i) => ({ id: m.id, correct: Boolean(i % 3), explanation: m.explanation })), writtenResults: [] }, completedAt: "2026-10-10T09:00:00Z" });
  const untaken = makeExam("exam", "Physiology", "3");
  state.exams.push({ examId: untaken.examId, testType: "exam", title: untaken.title, subject: "Physiology", year: "3", exam: untaken, answers: {}, result: null, generatedAt: "2026-10-11T09:00:00Z" });

  return async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname;
    const m = req.method;
    const api = p.startsWith("/api/") || ["/login", "/logout", "/signup", "/verify-email", "/resend-verification", "/request-password-reset", "/reset-password"].includes(p);
    if (!api) return false;
    // Page navigations that share a path with an API route are handled by the SPA fallback.
    if (m === "GET" && (req.headers.accept || "").includes("text/html") && !p.startsWith("/api/")) return false;

    if (p === "/login" && m === "POST") {
      const b = await readBody(req);
      if (!b.studentEmail || !b.password) return json(res, 400, { error: "Missing credentials." }), true;
      if (String(b.studentEmail).startsWith("unverified")) return json(res, 403, { error: "Verify your student email before logging in." }), true;
      if (b.password !== "Demo#12345a" && !String(b.studentEmail).startsWith("admin")) return json(res, 401, { error: "Incorrect email or password." }), true;
      const id = (String(b.studentEmail).startsWith("admin") ? "admin" : "user") + randomUUID();
      sessions.add(id);
      return json(res, 200, { ok: true }, setCookie(id)), true;
    }
    if (p === "/logout" && m === "POST") { sessions.delete(sid(req)); return json(res, 200, { ok: true }, setCookie("")), true; }
    if (p === "/signup" && m === "POST") return json(res, 200, { ok: true }), true;
    if (p === "/verify-email" && m === "POST") return json(res, 200, { ok: true }), true;
    if (p === "/resend-verification" && m === "POST") return json(res, 200, { ok: true }), true;
    if (p === "/request-password-reset" && m === "POST") return json(res, 200, { ok: true }), true;
    if (p === "/reset-password" && m === "POST") return json(res, 200, { ok: true }), true;

    if (p === "/api/cat-shares" && m === "POST") {
      if (!authed(req)) return json(res, 401, { error: "Not signed in." }), true;
      const b = await readBody(req);
      const token = randomUUID();
      state.shares.set(token, b.attemptId);
      return json(res, 200, { token }), true;
    }
    const shareMatch = /^\/api\/cat-shares\/([^/]+)(\/claim)?$/.exec(p);
    if (shareMatch) {
      const rec = state.exams.find((e) => e.attemptId === state.shares.get(shareMatch[1])) ?? state.exams[0];
      if (!state.shares.has(shareMatch[1])) return json(res, 404, { error: "This CAT share link was not found." }), true;
      if (shareMatch[2]) {
        if (!authed(req)) return json(res, 401, { error: "Not signed in." }), true;
        return json(res, 200, { exam: makeExam("cat", rec.subject, rec.year) }), true;
      }
      return json(res, 200, { cat: { title: rec.title, subject: rec.subject, year: rec.year, totalScore: rec.result.totalScore, totalMarks: rec.result.totalMarks, questionCount: 10 } }), true;
    }

    if (p === "/api/me") {
      if (!authed(req)) return json(res, 401, { error: "Not signed in." }), true;
      if (m === "PUT" || p === "/api/me/name") return false;
      return json(res, 200, { user: state.user }), true;
    }
    if (p === "/api/me/name" && m === "PUT") {
      if (!authed(req)) return json(res, 401, { error: "Not signed in." }), true;
      const b = await readBody(req);
      state.user.displayName = String(b.displayName || "").trim();
      return json(res, 200, { user: state.user }), true;
    }
    if (!authed(req)) return json(res, 401, { error: "Not signed in." }), true;

    if (p === "/api/exams" && m === "GET") return json(res, 200, { exams: state.exams }), true;
    if (p === "/api/exam-trials") return json(res, 200, { available: state.trials }), true;
    if (p === "/api/promo-codes/validate" && m === "POST") {
      const b = await readBody(req);
      return json(res, 200, { valid: b.code === "MOCK-PROMO", available: true }), true;
    }
    if (p.startsWith("/api/payments/reusable/")) return json(res, 200, {}), true;
    if (p === "/api/payments/stk-push" && m === "POST") {
      const b = await readBody(req);
      const id = `mock-${randomUUID()}`;
      state.payments.set(id, { polls: 0, testType: b.testType, used: false });
      return json(res, 200, { checkoutRequestId: id }), true;
    }
    const payMatch = /^\/api\/payments\/([^/]+)\/status$/.exec(p);
    if (payMatch) {
      const pay = state.payments.get(decodeURIComponent(payMatch[1]));
      if (!pay) return json(res, 404, { error: "Payment not found." }), true;
      pay.polls += 1;
      return json(res, 200, { status: pay.polls >= 2 ? "paid" : "pending", used: pay.used, testType: pay.testType }), true;
    }
    if (p === "/api/generate-test" && m === "POST") {
      const raw = await readRaw(req);
      await sleep(generateMs);
      const type = /name="test-type"\r\n\r\n(cat|exam)/.exec(raw)?.[1] === "exam" ? "exam" : "cat";
      const subject = /name="subject"\r\n\r\n([^\r]*)/.exec(raw)?.[1] || "Pharmacology";
      const year = /name="year"\r\n\r\n([^\r]*)/.exec(raw)?.[1] || "3";
      const exam = makeExam(type, subject, year);
      if (!/name="paymentId"/.test(raw) && !/name="promoCode"\r\n\r\n\S/.test(raw)) state.trials[type] = false;
      return json(res, 200, exam), true;
    }
    const deliver = /^\/api\/exams\/([^/]+)\/confirm-delivery$/.exec(p);
    if (deliver) return json(res, 200, { ok: true }), true;
    if (p === "/api/submit-exam" && m === "POST") {
      const b = await readBody(req);
      if (!state.user.displayName) return json(res, 428, { error: "Name required.", nameRequired: true }), true;
      const mcqIds = Object.keys(b.answers || {}).filter((k) => k.startsWith("mcq"));
      const correct = mcqIds.filter((k) => b.answers[k] === "Option B text").length;
      const written = Object.keys(b.answers || {}).filter((k) => !k.startsWith("mcq"));
      const result = {
        totalScore: correct + written.length * 2, totalMarks: mcqIds.length + written.length * 20,
        mcqScore: correct, mcqTotal: mcqIds.length, writtenScore: written.length * 2, writtenTotal: written.length * 20,
        mcqResults: mcqIds.map((k) => ({ id: k, correct: b.answers[k] === "Option B text", explanation: "Mock explanation." })),
        writtenResults: written.map((k) => ({ id: k, score: 2, maxScore: 20, feedback: "Mock feedback." })),
      };
      return json(res, 200, result), true;
    }
    if (p === "/api/admin/users" && m === "GET") {
      if (!isAdmin(req)) return json(res, 403, { error: "Forbidden" }), true;
      return json(res, 200, { users: state.users, adminUserId: 1, verificationStats: { recentlyDeleted: 3 } }), true;
    }
    const del = /^\/api\/admin\/users\/([^/]+)$/.exec(p);
    if (del && m === "DELETE") {
      if (!isAdmin(req)) return json(res, 403, { error: "Forbidden" }), true;
      state.users = state.users.filter((u) => String(u.id) !== del[1]);
      return json(res, 200, { ok: true }), true;
    }
    return json(res, 404, { error: `Mock API: no route for ${m} ${p}` }), true;
  };
}
