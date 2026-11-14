// End-to-end smoke test against the production build + DEV-ONLY mock API.
//   npm run build && npm run test:e2e
// Needs a Chromium: set CHROMIUM_PATH (defaults to Playwright's PLAYWRIGHT_BROWSERS_PATH/chromium) and have
// `playwright-core` installed (it is a devDependency).
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { root } from "../scripts/shared.mjs";
import { createAppServer, readIndex } from "../scripts/server.mjs";
import { createMockApi } from "../dev/mock-api.mjs";

const dist = path.join(root, "dist");
const server = createAppServer({ roots: [dist], getIndexHtml: () => readIndex(path.join(dist, "index.html")), mockApi: createMockApi({ generateMs: 4000 }) });
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const executablePath = process.env.CHROMIUM_PATH || (process.env.PLAYWRIGHT_BROWSERS_PATH ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium") : undefined);
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const results = [];
const step = async (name, fn) => { await fn(); results.push(name); console.log("✓", name); };

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await step("intro shows a Skip button immediately and skipping reveals the homepage", async () => {
    await page.goto(base + "/");
    await page.click(".intro__skip", { timeout: 2000 });
    await page.waitForSelector("#pricing");
    assert.match(await page.textContent("#pricing"), /KSh 30/);
    assert.match(await page.textContent("#pricing"), /KSh 79/);
  });
  await step("legacy URLs redirect to clean routes", async () => {
    await page.goto(base + "/pages/login.html");
    await page.waitForURL((u) => u.pathname === "/login");
  });
  await step("protected pages redirect to login", async () => {
    await page.goto(base + "/portal");
    await page.waitForURL("**/login**");
  });
  await step("login → dashboard", async () => {
    await page.fill("input[type=email]", "demo.student@students.uonbi.ac.ke");
    await page.fill("input[type=password]", "Demo#12345a");
    await page.click("button[type=submit]");
    await page.waitForURL("**/portal");
    await page.waitForSelector(".welcome");
  });
  await step("set up a CAT (streamed) with the progress overlay, then land on the exam", async () => {
    await page.goto(base + "/examroom");
    await page.click("label.choice >> nth=0");
    await page.selectOption("select", "3");
    await page.fill("input[name=subject]", "Pharmacology");
    await page.click("#start-exam");
    await page.waitForSelector(".gen", { timeout: 8000 });
    const genText = await page.textContent(".gen");
    assert.doesNotMatch(genText, /minutes|Generat/i);
    await page.waitForURL("**/examinterface", { timeout: 15000 });
    // The exam opens on the first batch; the rest streams in while the student can already answer.
    await page.waitForSelector(".stream-banner", { timeout: 4000 });
    assert.ok(await page.locator(".qcard").count(), "first question is visible while the stream continues");
    assert.ok(await page.locator(".qbtn--pending").count(), "navigator shows questions still on the way");
    assert.ok(await page.locator(".exam-submit").isDisabled(), "Submit stays locked until every question has arrived");
    const early = Number((/(\d+)\s+of\s+\d+\s+question/.exec(await page.textContent(".stream-banner")) || [])[1] || 0);
    await page.waitForSelector(".stream-banner", { state: "detached", timeout: 8000 });
    assert.ok(await page.locator(".exam-submit").isDisabled(), "Submit stays locked after the stream ends while questions are unanswered");
    assert.ok(await page.locator(".qbtn:not(.qbtn--demo)").count() > early, "more questions arrived after the exam opened");
  });
  await step("answer, submit, provide name (428 flow), see result", async () => {
    // Submit is locked (dimmed, disabled) until every question is answered.
    await page.click("label.option >> nth=1");
    assert.ok(await page.locator(".exam-submit").isDisabled(), "Submit is locked with unanswered questions");
    assert.ok(Number(await page.locator(".exam-submit").evaluate((el) => getComputedStyle(el).opacity)) < 0.5, "locked Submit is dimmed");
    assert.match(await page.textContent(".submit-hint"), /Answer the remaining \d+ question/);
    const count = await page.locator(".qbtn:not(.qbtn--demo)").count();
    for (let i = 1; i < count; i++) {
      await page.click('button:has-text("Next")');
      await page.click("label.option >> nth=1");
    }
    await page.waitForSelector(".exam-submit:not([disabled])");
    await page.click(".exam-submit");
    await page.click('dialog[open] button:has-text("Submit CAT")');
    await page.fill("#candidate-name", "Demo Student");
    await page.click("text=Save name and continue");
    await page.waitForSelector(".result");
  });
  await step("performance lists attempts and opens a review", async () => {
    await page.click("text=Review results");
    await page.waitForURL("**/performance");
    await page.click(".result-card >> nth=0");
    await page.waitForSelector("dialog[open] .qreview");
  });
  await step("mobile layout has no horizontal scroll", async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.keyboard.press("Escape");
    await page.goto(base + "/portal");
    await page.waitForSelector(".welcome");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `horizontal overflow ${overflow}px`);
  });
  await step("production-like stream: all 50 questions arrive despite a retry notice mid-stream", async () => {
    await page.evaluate(() => fetch("/api/dev/reset-trials", { method: "POST" }));
    await page.goto(base + "/examroom");
    await page.click("label.choice >> nth=0");
    await page.selectOption("select", "3");
    await page.fill("input[name=subject]", "Realistic");
    await page.click("#start-exam");
    await page.waitForURL("**/examinterface", { timeout: 15000 });
    await page.waitForSelector(".stream-banner", { timeout: 5000 });
    await page.waitForSelector(".stream-banner", { state: "detached", timeout: 15000 });
    assert.equal(await page.locator(".qbtn:not(.qbtn--demo):not(.qbtn--pending)").count(), 50, "all 50 questions are on screen");
    assert.equal(await page.locator(".alert--warning, .alert:has-text('Not every question')").count(), 0, "no incomplete-stream warning");
    assert.ok(await page.locator(".exam-submit").isDisabled(), "Submit is still locked until all 50 are answered");
    await page.evaluate(() => localStorage.removeItem("currentExam"));
  });
  await step("clock starts when the first question arrives, flashes red only in the last 10 s, auto-submits at zero, never shows 'Submission failed'", async () => {
    await page.evaluate(() => {
      fetch("/api/dev/reset-trials", { method: "POST" });
      // a leftover from an earlier exam, started hours ago: it must not poison the new exam's clock
      localStorage.setItem("currentExam", JSON.stringify({ examId: "old", startedAt: Date.now() - 3 * 3600 * 1000, mcqs: [{ id: "mcq1", question: "x", options: ["a", "b"] }] }));
    });
    await page.goto(base + "/examroom");
    await page.click("label.choice >> nth=0");
    await page.selectOption("select", "3");
    await page.fill("input[name=subject]", "Pharmacology");
    await page.click("#start-exam");
    await page.waitForURL("**/examinterface", { timeout: 15000 });
    await page.waitForSelector(".timer");
    const first = await page.textContent(".timer");
    assert.match(first, /4[45]:\d\d/, `clock starts at the full duration, got ${first}`);
    await page.waitForSelector(".stream-banner", { state: "detached", timeout: 15000 });
    assert.equal(await page.locator("text=Submission failed").count(), 0);
    // jump the stored clock to 12 s before the deadline and reload (a reload is a legitimate resume)
    await page.evaluate(() => {
      const exam = JSON.parse(localStorage.getItem("currentExam"));
      exam.startedAt = Date.now() - (exam.durationMinutes ? exam.durationMinutes * 60 - 12 : 45 * 60 - 12) * 1000;
      localStorage.setItem("currentExam", JSON.stringify(exam));
    });
    page.once("dialog", (d) => d.accept());
    await page.reload();
    await page.waitForSelector(".timer");
    assert.ok(!(await page.getAttribute(".timer", "class")).includes("is-danger"), "not red with 12 s left");
    await page.waitForSelector(".timer.is-danger", { timeout: 6000 });
    await page.waitForSelector(".result", { timeout: 15000 });
    assert.equal(await page.locator("text=Submission failed").count(), 0);
  });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${results.length} e2e steps passed`);
