/**
 * Assessment start flow — a faithful port of the original examroomprep.js.
 *
 * Order of checks (unchanged):
 *   1. promo code?   POST /api/promo-codes/validate { code }  → valid && available
 *      otherwise:
 *   2. pending payment saved in localStorage (mdqPendingPayment:<type>) → GET /api/payments/:id/status
 *   3. reusable paid payment                                            → GET /api/payments/reusable/:type
 *   4. free trial                                                       → GET /api/exam-trials
 *   5. otherwise pay: POST /api/payments/stk-push { phoneNumber, testType } then poll
 *      GET /api/payments/:id/status every 3 s (max 60 times)
 *   6. generate: POST /api/generate-test (multipart; + paymentId when a payment is being consumed)
 *
 * Nothing here ever marks a payment as paid on its own: only a server status of "paid" counts.
 */
import { request, ApiError, errorMessage } from "../../lib/api";
import { PAYMENT_POLL_ATTEMPTS, PAYMENT_POLL_INTERVAL_MS, PRICING, type TestType } from "../../lib/config";
import { KEYS, pendingPaymentKey, safeGet, safeRemove, safeSet, saveCurrentExam, clearAnswerDraft } from "../../lib/storage";
import type { ExamPayload, PaymentStatus, TrialsResponse } from "../../types/api";

export type StartStage = "promo" | "payment-check" | "trial" | "payment" | "generate";

export interface StartInput {
  testType: TestType;
  promoCode: string;
  year: string;
  subject: string;
  topic: string;
  files: File[];
}

export interface StartUI {
  signal: AbortSignal;
  status: (message: string, state: "info" | "success" | "error") => void;
  stage: (stage: StartStage) => void;
  /** Ask the student to confirm the price and give an M-Pesa number. Resolve null if they decline. */
  requestPayment: (testType: TestType, amount: number) => Promise<string | null>;
  /** Called while waiting for the M-Pesa prompt to be approved. */
  paymentWaiting: (info: { attempt: number; max: number } | null) => void;
}

export class StartError extends Error {
  readonly paymentConfirmed: boolean;
  constructor(message: string, paymentConfirmed: boolean) {
    super(message);
    this.name = "StartError";
    this.paymentConfirmed = paymentConfirmed;
  }
}

const TERMINAL_FAILURES = ["failed", "expired", "cancelled"];

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function paymentAmount(testType: TestType): number {
  return testType === "cat" ? PRICING.cat : PRICING.exam;
}

async function fetchPaymentStatus(id: string, signal: AbortSignal) {
  return request<PaymentStatus & { error?: string }>(`/api/payments/${encodeURIComponent(id)}/status`, { signal });
}

/** Poll until paid (true) or a terminal failure / timeout (false). Throws AbortError if the student stops waiting. */
export async function waitForPayment(id: string, ui: StartUI): Promise<boolean> {
  try {
    for (let attempt = 1; attempt <= PAYMENT_POLL_ATTEMPTS; attempt += 1) {
      ui.paymentWaiting({ attempt, max: PAYMENT_POLL_ATTEMPTS });
      await sleep(PAYMENT_POLL_INTERVAL_MS, ui.signal);
      const result = await fetchPaymentStatus(id, ui.signal);
      if (!result.ok) throw new Error(result.data.error || "Could not check payment status.");
      if (result.data.status === "paid") return true;
      if (["failed", "expired"].includes(result.data.status ?? "")) return false;
    }
    return false;
  } finally {
    ui.paymentWaiting(null);
  }
}

/** Returns the generated exam, or null when the student declined to pay. Throws StartError on failure. */
export async function startAssessment(input: StartInput, ui: StartUI): Promise<ExamPayload | null> {
  const { testType } = input;
  const promoCode = input.promoCode.trim();
  let paidPaymentConfirmed = false;

  try {
    let promoValid = false;
    let paymentId: string | null = null;
    let existingPaymentPending = false;
    let trials: TrialsResponse = { available: {} };

    if (promoCode) {
      ui.stage("promo");
      ui.status("Checking your promo code…", "info");
      const promo = await request<{ valid?: boolean; available?: boolean; error?: string }>("/api/promo-codes/validate", {
        method: "POST",
        json: { code: promoCode },
        signal: ui.signal,
      });
      if (!promo.ok) throw new Error(promo.data.error || "Promo code could not be checked.");
      if (!promo.data.valid) throw new Error("That promo code is not valid.");
      if (!promo.data.available) throw new Error("That promo code is generating another test. Try shortly.");
      promoValid = true;
    } else {
      ui.stage("payment-check");
      ui.status("Checking access and payment status before starting your assessment.", "info");
      const pendingKey = pendingPaymentKey(testType);
      const pendingPaymentId = safeGet(pendingKey);

      if (pendingPaymentId) {
        ui.status("Checking your existing payment…", "info");
        const pending = await fetchPaymentStatus(pendingPaymentId, ui.signal);
        if (!pending.ok) throw new Error(pending.data.error || "Your existing payment could not be checked.");
        const data = pending.data;
        if (data.status === "paid" && !data.used && data.testType === testType) {
          paymentId = pendingPaymentId;
          paidPaymentConfirmed = true;
        } else if (data.status === "pending" && data.testType === testType) {
          existingPaymentPending = true;
          ui.stage("payment");
          if (await waitForPayment(pendingPaymentId, ui)) {
            paymentId = pendingPaymentId;
            paidPaymentConfirmed = true;
          } else {
            const latest = await fetchPaymentStatus(pendingPaymentId, ui.signal);
            if (latest.ok && TERMINAL_FAILURES.includes(latest.data.status ?? "")) {
              safeRemove(pendingKey);
              existingPaymentPending = false;
            }
          }
        } else if (data.used || TERMINAL_FAILURES.includes(data.status ?? "")) {
          safeRemove(pendingKey);
        }
      }

      if (existingPaymentPending && !paymentId) {
        throw new Error("Your M-Pesa payment is still being confirmed. Press START again shortly; you will not be charged again.");
      }

      if (!paymentId) {
        const reusable = await request<{ checkoutRequestId?: string; error?: string }>(`/api/payments/reusable/${encodeURIComponent(testType)}`, {
          signal: ui.signal,
        });
        if (!reusable.ok) throw new Error(reusable.data.error || "Previous payment status could not be checked.");
        if (reusable.data.checkoutRequestId) {
          paymentId = reusable.data.checkoutRequestId;
          paidPaymentConfirmed = true;
          safeSet(pendingKey, paymentId);
        }
      }

      if (!paymentId) {
        ui.stage("trial");
        ui.status("Checking your free trial…", "info");
        const trialResponse = await request<TrialsResponse & { error?: string }>("/api/exam-trials", { signal: ui.signal });
        if (!trialResponse.ok) throw new Error(trialResponse.data.error || "Free trial status could not be checked.");
        trials = trialResponse.data;
      }
    }

    if (!promoValid && !paymentId && !trials.available?.[testType]) {
      // No promo, no existing payment, no free trial left → this assessment must be paid for.
      const amount = paymentAmount(testType);
      ui.stage("payment");
      const phoneNumber = await ui.requestPayment(testType, amount);
      if (!phoneNumber) return null;

      ui.status("Sending the M-Pesa prompt to your phone…", "info");
      const payment = await request<{ checkoutRequestId?: string; error?: string }>("/api/payments/stk-push", {
        method: "POST",
        json: { phoneNumber, testType },
        signal: ui.signal,
      });
      if (!payment.ok || !payment.data.checkoutRequestId) throw new Error(payment.data.error || "Payment could not be started.");

      const checkoutRequestId = payment.data.checkoutRequestId;
      safeSet(pendingPaymentKey(testType), checkoutRequestId);
      ui.status("Payment prompt sent. Approve it on your phone; we will confirm it here.", "info");

      if (!(await waitForPayment(checkoutRequestId, ui))) {
        const latest = await fetchPaymentStatus(checkoutRequestId, ui.signal);
        if (latest.ok && TERMINAL_FAILURES.includes(latest.data.status ?? "")) safeRemove(pendingPaymentKey(testType));
        throw new Error("Payment was not completed. Please try again.");
      }
      paymentId = checkoutRequestId;
      paidPaymentConfirmed = true;
    }

    if (paymentId) {
      ui.status("Payment successful. Preparing your assessment.", "success");
      await sleep(1500, ui.signal);
    }

    ui.stage("generate");
    ui.status("Generating your assessment. This may take a few minutes; please keep this page open.", "info");

    // Field names are exactly those the original <form> posted.
    const form = new FormData();
    form.append("test-type", testType);
    form.append("year", input.year);
    form.append("subject", input.subject);
    form.append("topic", input.topic);
    form.append("promoCode", promoCode);
    for (const file of input.files) form.append("materials", file);
    if (paymentId) form.append("paymentId", paymentId);

    const response = await request<ExamPayload & { error?: string }>("/api/generate-test", { method: "POST", form, signal: ui.signal });
    if (!response.ok) throw new Error(response.data.error || `HTTP Error status:${response.status}`);

    const exam = response.data as ExamPayload;
    exam.year = exam.year || input.year;
    exam.subject = exam.subject || input.subject;
    // A new exam must never inherit answers drafted for a previous one.
    clearAnswerDraft();
    saveCurrentExam(exam);
    safeRemove(KEYS.currentExamResult);
    ui.status("", "info");
    return exam;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new StartError(
        paidPaymentConfirmed
          ? "Stopped. Your payment is confirmed and saved. Press START to continue; you will not be charged again."
          : "Stopped waiting. If you approved the M-Pesa prompt, press START to resume; you will not be charged again.",
        paidPaymentConfirmed,
      );
    }
    const message = error instanceof ApiError || error instanceof Error ? errorMessage(error) : "Could not start the assessment.";
    throw new StartError(
      paidPaymentConfirmed ? `${message} Your payment is confirmed and saved. Press START to retry; you will not be charged again.` : message,
      paidPaymentConfirmed,
    );
  }
}
