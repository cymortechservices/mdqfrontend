import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "../../components/ui/Feedback";
import { Button, ButtonLink } from "../../components/ui/Button";
import { PasswordField } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Link, useNavigate, useSearchParams } from "../../lib/router";
import { errorMessage, request } from "../../lib/api";
import { usePageMeta } from "../../lib/meta";
import { PASSWORD_MAX, PASSWORD_REQUIREMENTS, checkPassword, resetSchema, validate, type FieldErrors } from "../../lib/validation";
import { AuthCard } from "./AuthParts";

export default function ResetPasswordPage() {
  usePageMeta({ title: "Choose a new password | MDQ", path: "/reset-password" });
  const token = useSearchParams().get("token");
  const navigate = useNavigate();
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<FieldErrors<"password" | "confirm">>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!token) {
    return (
      <AuthCard icon="alertTriangle" title="This reset link isn’t valid" subtitle="The link is missing its reset code. Request a new one and use the link in the latest email.">
        <ButtonLink to="/forgot-password" size="lg" block>
          Request a new link
        </ButtonLink>
      </AuthCard>
    );
  }

  const checks = checkPassword(values.password.trim());

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const check = validate<"password" | "confirm">(resetSchema, values);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    setMessage(null);
    setBusy(true);
    try {
      // Same endpoint and payload as the original: POST /reset-password { token, password }.
      const result = await request<{ error?: string }>("/reset-password", {
        method: "POST",
        json: { token, password: values.password.trim() },
      });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.data.error || "Could not reset your password." });
        return;
      }
      setMessage({ tone: "success", text: "Password reset. Redirecting to login…" });
      timer.current = window.setTimeout(() => navigate("/login"), 800);
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      icon="lockKeyhole"
      title="Choose a new password"
      subtitle="Pick a strong password you haven’t used before."
      footer={
        <p>
          Link expired? <Link to="/forgot-password">Request a new one</Link>
        </p>
      }
    >
      {message ? (
        <Alert tone={message.tone}>
          {message.text}
          {message.tone === "error" ? (
            <>
              {" "}
              <Link to="/forgot-password">Request a new link</Link>
            </>
          ) : null}
        </Alert>
      ) : null}
      <form className="form" onSubmit={onSubmit} noValidate>
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={values.password}
          onChange={(event) => setValues((v) => ({ ...v, password: event.target.value }))}
          error={errors.password}
          required
        />
        <ul className="reqs" aria-label="Password requirements">
          {PASSWORD_REQUIREMENTS.map((req) => (
            <li key={req.key} className={checks[req.key] ? "is-met" : ""}>
              <Icon name={checks[req.key] ? "checkCircle" : "circle"} size={15} />
              <span>{req.label}</span>
            </li>
          ))}
        </ul>
        <PasswordField
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={values.confirm}
          onChange={(event) => setValues((v) => ({ ...v, confirm: event.target.value }))}
          error={errors.confirm}
          required
        />
        <Button type="submit" size="lg" block loading={busy} iconRight="arrowRight">
          Reset password
        </Button>
      </form>
    </AuthCard>
  );
}
