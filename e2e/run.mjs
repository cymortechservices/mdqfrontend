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
const server = createAppServer({ roots: [dist], getIndexHtml: () => readIndex(path.join(dist, "index.html")), mockApi: createMockApi({ generateMs: 1500 }) });
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
    assert.match(await page.textContent("#pricing"), /KSh 99/);
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
  await step("generate a CAT with the loading overlay, then land on the exam", async () => {
    await page.goto(base + "/examroom");
    await page.click("label.choice >> nth=0");
    await page.selectOption("select", "3");
    await page.fill("input[name=subject]", "Pharmacology");
    await page.click("#start-exam");
    await page.waitForSelector(".gen", { timeout: 8000 });
    assert.match(await page.textContent(".gen"), /about 4 minutes/);
    await page.waitForURL("**/examinterface", { timeout: 15000 });
  });
  await step("answer, submit, provide name (428 flow), see result", async () => {
    await page.click("label.option >> nth=1");
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
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${results.length} e2e steps passed`);
