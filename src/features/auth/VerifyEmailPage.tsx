import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { Link, useNavigate, useSearchParams } from "../../lib/router";
import { errorMessage, request } from "../../lib/api";
import { SHARED_CAT_PARAM_PATTERN } from "../../lib/config";
import { usePageMeta } from "../../lib/meta";
import { verifySchema, validate, type FieldErrors } from "../../lib/validation";
import { AuthCard } from "./AuthParts";

export default function VerifyEmailPage() {
  usePageMeta({ title: "Verify your email | MDQ", path: "/verify-email" });
  const params = useSearchParams();
  const navigate = useNavigate();
  const created = params.get("created") === "1";
  const emailStatus = params.get("emailStatus");
  const sharedCat = params.get("sharedCat");

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "code">>({});
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error" | "warning"; text: string } | null>(() => {
    if (!created) return null;
    const address = params.get("email") ?? "";
    return emailStatus === "sent"
      ? {
          tone: "success",
          text: `Your account has been created. We are sending a verification code to ${address}. Check your inbox and spam folder, then enter the six-digit code below.`,
        }
      : {
          tone: "warning",
          text: `Your account has been created, but we could not start the verification email for ${address}. Use the button below to request a code.`,
        };
  });
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // The original froze the resend button for 10 s after a fresh sign-up whose email was sent.
  const [resendLocked, setResendLocked] = useState(created && emailStatus === "sent");

  useEffect(() => {
    if (!resendLocked) return undefined;
    const timer = window.setTimeout(() => {
      setResendLocked(false);
      setStatus({ tone: "info", text: "If the code has not arrived, check your spam folder or request a new one below." });
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [resendLocked]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const check = validate<"email" | "code">(verifySchema, { email, code });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      // Same endpoint and payload as the original: POST /verify-email { studentEmail, code }.
      const result = await request<{ error?: string }>("/verify-email", { method: "POST", json: { studentEmail: email, code } });
      if (!result.ok) {
        setStatus({ tone: "error", text: result.data.error || "Verification failed." });
        return;
      }
      const query = new URLSearchParams({ verified: "1" });
      if (sharedCat && SHARED_CAT_PARAM_PATTERN.test(sharedCat)) query.set("sharedCat", sharedCat);
      navigate(`/login?${query.toString()}`);
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const check = validate<"email" | "code">(verifySchema.pick({ email: true }), { email });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    setStatus({ tone: "info", text: "Sending a new verification code…" });
    setResending(true);
    try {
      const result = await request<{ message?: string; error?: string }>("/resend-verification", { method: "POST", json: { studentEmail: email } });
      setStatus({
        tone: result.ok ? "success" : "error",
        text: result.data.message || result.data.error || "Could not resend the verification email.",
      });
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error) });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard
      icon="mail"
      eyebrow="Account verification"
      title="Check your student email"
      subtitle={status ? undefined : "Enter the six-digit code sent to your student email."}
      footer={
        <p>
          <Link to="/login">Back to log in</Link>
        </p>
      }
    >
      {status ? <Alert tone={status.tone}>{status.text}</Alert> : null}
      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Student email"
          type="email"
          name="studentEmail"
          icon="mail"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          required
        />
        <TextField
          label="Six-digit verification code"
          name="code"
          className="code-field"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          hint="The code expires 10 minutes after it is sent."
          error={errors.code}
          required
        />
        <Button type="submit" size="lg" block loading={busy} iconRight="arrowRight">
          Verify email
        </Button>
        <Button type="button" variant="secondary" block loading={resending} disabled={resendLocked} onClick={() => void resend()}>
          Resend verification email
        </Button>
      </form>
    </AuthCard>
  );
}
