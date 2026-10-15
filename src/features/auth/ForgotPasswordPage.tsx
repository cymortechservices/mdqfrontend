import { useState, type FormEvent } from "react";
import { Alert } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { Link } from "../../lib/router";
import { errorMessage, request } from "../../lib/api";
import { usePageMeta } from "../../lib/meta";
import { forgotSchema, validate } from "../../lib/validation";
import { AuthCard } from "./AuthParts";

export default function ForgotPasswordPage() {
  usePageMeta({ title: "Reset your password | MDQ", path: "/forgot-password", description: "Request a password reset link for your MDQ account." });
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const check = validate<"email">(forgotSchema, { email });
    if (!check.ok) {
      setError(check.errors.email);
      return;
    }
    setError(undefined);
    setStatus(null);
    setBusy(true);
    try {
      // Same endpoint and payload as the original: POST /request-password-reset { studentEmail }.
      const result = await request<{ message?: string; error?: string }>("/request-password-reset", {
        method: "POST",
        json: { studentEmail: email },
      });
      setStatus({
        tone: result.ok ? "success" : "error",
        text: result.data.message || result.data.error || "Request completed.",
      });
    } catch (cause) {
      setStatus({ tone: "error", text: errorMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      icon="lockKeyhole"
      title="Reset your password"
      subtitle="Enter your student email and we’ll send you a link to choose a new password."
      footer={
        <p>
          Remembered it? <Link to="/login">Back to log in</Link>
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
          error={error}
          required
        />
        <Button type="submit" size="lg" block loading={busy} iconRight="arrowRight">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
