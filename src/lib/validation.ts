/**
 * Form validation. The rules below are ported 1:1 from the original login.js / signup.js.
 * Do not weaken the student-email restriction.
 */
import { z } from "zod";
import { ALLOWED_EMAIL_DOMAINS } from "./config";

const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+$/;

export function checkStudentEmail(email: string): { clean: string; valid: boolean } {
  const clean = email.trim().toLowerCase();
  const domain = clean.split("@")[1];
  return { clean, valid: EMAIL_REGEX.test(clean) && ALLOWED_EMAIL_DOMAINS.includes(domain ?? "") };
}

export const STUDENT_EMAIL_MESSAGE = "You must use your student email";

/** WhatsApp number rule from the original signup form. */
export const WHATSAPP_REGEX = /^\+?(\d{3})?0?\d{9}$/;
export const WHATSAPP_MESSAGE = "Please enter a valid WhatsApp Number";

export function checkWhatsApp(value: string): { clean: string; valid: boolean } {
  const clean = value.trim();
  return { clean, valid: WHATSAPP_REGEX.test(clean) };
}

export const PASSWORD_SYMBOLS = "# $ % ^ & ( ) ? / @ ~ _ { } [ ] \\ -";
const SYMBOL_REGEX = /[#$%\^&\(\)?\/@~_{}\[\]\\\-]/;

export interface PasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
}

export const PASSWORD_REQUIREMENTS: { key: keyof PasswordChecks; label: string }[] = [
  { key: "length", label: "At least 8 characters" },
  { key: "lowercase", label: "At least one lowercase letter" },
  { key: "uppercase", label: "At least one uppercase letter" },
  { key: "number", label: "At least one number" },
  { key: "symbol", label: "At least one special character" },
];

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: SYMBOL_REGEX.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  return Object.values(checkPassword(password)).every(Boolean);
}

/** Inputs are capped at 25 characters in the original forms; kept so users cannot create a password the login box would reject. */
export const PASSWORD_MAX = 25;

const studentEmail = z
  .string()
  .trim()
  .min(1, "Enter your student email")
  .refine((value) => checkStudentEmail(value).valid, STUDENT_EMAIL_MESSAGE);

const newPassword = z
  .string()
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`)
  .refine((value) => isStrongPassword(value.trim()), "Password is missing some of the requirements below.");

export const loginSchema = z.object({
  email: studentEmail,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`),
});

export const signupSchema = z
  .object({
    email: studentEmail,
    whatsapp: z.string().refine((value) => checkWhatsApp(value).valid, WHATSAPP_MESSAGE),
    password: newPassword,
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Kindly ensure that both passwords match",
  });

export const forgotSchema = z.object({
  email: z.string().trim().min(1, "Enter your student email").email("Enter a valid email address"),
});

export const resetSchema = z
  .object({ password: newPassword, confirm: z.string().min(1, "Confirm your password") })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "The passwords must match",
  });

export const verifySchema = z.object({
  email: z.string().trim().min(1, "Enter your student email").email("Enter a valid email address"),
  code: z.string().regex(/^[0-9]{6}$/, "Enter the six-digit code"),
});

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

/** Run a zod schema and return the first message per field. */
export function validate<T extends string>(
  schema: z.ZodTypeAny,
  values: unknown,
): { ok: true } | { ok: false; errors: FieldErrors<T> } {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true };
  const errors: FieldErrors<T> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form") as T;
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

/** Kenyan mobile numbers accepted for M-Pesa: 07xx/01xx, 7xx/1xx, 2547xx/2541xx, +2547xx/+2541xx. */
export function cleanPhone(value: string): string {
  return value.replace(/[\s-]/g, "");
}
export function isKenyanMobile(value: string): boolean {
  return /^(?:\+?254|0)?[17]\d{8}$/.test(cleanPhone(value));
}

/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
