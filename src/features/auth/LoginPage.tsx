import { useState, type FormEvent } from "react";
import { Alert } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { PasswordField, TextField } from "../../components/ui/Field";
import { Link, useNavigate, useSearchParams } from "../../lib/router";
import { errorMessage, request } from "../../lib/api";
import { SHARED_CAT_PARAM_PATTERN } from "../../lib/config";
import { usePageMeta } from "../../lib/meta";
import { checkStudentEmail, loginSchema, safeNextPath, validate, type FieldErrors } from "../../lib/validation";
import { useAuth } from "./AuthContext";
import { AuthCard } from "./AuthParts";

const VERIFY_REQUIRED = "Verify your student email before logging in.";

type Banner =
  | { kind: "error"; text: string; signup?: boolean }
  | { kind: "verify"; email: string; text: string }
  | null;

export default function LoginPage() {
  usePageMeta({ title: "Log in | MDQ", path: "/login", description: "Log in to MDQ to practise CATs and full exams." });
  const params = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const sharedCat = params.get("sharedCat");
  const validShared = sharedCat && SHARED_CAT_PARAM_PATTERN.test(sharedCat) ? sharedCat : null;
  const next = safeNextPath(params.get("next"));
  const verified = params.get("verified") === "1";
  const suffix = validShared ? `?sharedCat=${encodeURIComponent(validShared)}` : "";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBanner(null);
    const check = validate<"email" | "password">(loginSchema, { email, password });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    const studentEmail = checkStudentEmail(email).clean;
    setBusy(true);
    try {
      const result = await request<{ error?: string }>("/login", {
        method: "POST",
        json: { studentEmail, password: password.trim() },
      });
      if (!result.ok) {
        if (result.status === 403 && result.data.error === VERIFY_REQUIRED) {
          setBanner({ kind: "verify", email: studentEmail, text: VERIFY_REQUIRED });
        } else {
          setBanner({ kind: "error", text: result.data.error || "Could not log you in.", signup: result.status === 404 });
        }
        return;
      }
      await refresh();
      navigate(validShared ? `/shared-cat?token=${encodeURIComponent(validShared)}` : (next ?? "/portal"), { replace: true });
    } catch (error) {
      setBanner({ kind: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const resend = async (studentEmail: string) => {
    setResending(true);
    try {
      const result = await request<{ error?: string }>("/resend-verification", { method: "POST", json: { studentEmail } });
      if (result.ok) {
        navigate(`/verify-email?email=${encodeURIComponent(studentEmail)}`);
        return;
      }
      setBanner({ kind: "verify", email: studentEmail, text: result.data.error || "Could not resend the verification email." });
    } catch (error) {
      setBanner({ kind: "verify", email: studentEmail, text: errorMessage(error) });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard
      icon="graduationCap"
      title="Welcome back, Dr."
      subtitle="Log in with your student email to continue practising."
      footer={
        <p>
          New to MDQ? <Link to={`/signup${suffix}`}>Create an account</Link>
        </p>
      }
    >
      {verified && !banner ? <Alert tone="success">Email verified. You can now log in.</Alert> : null}
      {banner?.kind === "error" ? (
        <Alert tone="error">
          {banner.text}
          {banner.signup ? (
            <>
              {" "}
              <Link to={`/signup${suffix}`}>Create an account</Link>
            </>
          ) : null}
        </Alert>
      ) : null}
      {banner?.kind === "verify" ? (
        <Alert
          tone="warning"
          title={banner.text}
          action={
            <Button size="sm" variant="secondary" loading={resending} onClick={() => void resend(banner.email)}>
              Resend verification email
            </Button>
          }
        >
          We’ll send a new six-digit code to {banner.email}.
        </Alert>
      ) : null}

      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Student email"
          type="email"
          name="email"
          icon="mail"
          autoComplete="username"
          placeholder="name@students.uonbi.ac.ke"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => {
            if (email.trim() && !checkStudentEmail(email).valid) setErrors((e) => ({ ...e, email: "You must use your student email" }));
            else setErrors((e) => ({ ...e, email: undefined }));
          }}
          error={errors.email}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          maxLength={25}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          required
        />
        <div className="form__row">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" block loading={busy} iconRight="arrowRight">
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}
