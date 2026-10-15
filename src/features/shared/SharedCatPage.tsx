import { useEffect, useState } from "react";
import { Alert, Skeleton } from "../../components/ui/Feedback";
import { Button, ButtonLink } from "../../components/ui/Button";
import { api, errorMessage, request } from "../../lib/api";
import { SHARE_TOKEN_PATTERN } from "../../lib/config";
import { usePageMeta } from "../../lib/meta";
import { useNavigate, useSearchParams } from "../../lib/router";
import { KEYS, clearAnswerDraft, safeRemove, saveCurrentExam } from "../../lib/storage";
import type { ExamPayload, SharedCat } from "../../types/api";

type Session = "checking" | "signed-in" | "signed-out" | "unknown";

export default function SharedCatPage() {
  usePageMeta({ title: "CAT challenge | MDQ", path: "/shared-cat", description: "A classmate shared their CAT result on MDQ." });
  const navigate = useNavigate();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const valid = SHARE_TOKEN_PATTERN.test(token);

  const [cat, setCat] = useState<SharedCat | null>(null);
  const [status, setStatus] = useState(valid ? "Loading CAT result…" : "This CAT share link is invalid.");
  const [failed, setFailed] = useState(!valid);
  const [session, setSession] = useState<Session>("checking");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!valid) return undefined;
    const abort = new AbortController();
    setStatus("Loading CAT result…");
    setFailed(false);
    api<{ cat: SharedCat }>(`/api/cat-shares/${encodeURIComponent(token)}`, { signal: abort.signal, fallbackMessage: "Could not load CAT result." })
      .then((data) => {
        setCat(data.cat);
        setStatus("");
      })
      .catch((cause) => {
        if (abort.signal.aborted) return;
        console.error("Could not load shared CAT result:", cause);
        setStatus(errorMessage(cause, "Could not load CAT result."));
        setFailed(true);
      });
    return () => abort.abort();
  }, [token, valid]);

  useEffect(() => {
    if (!cat) return undefined;
    const abort = new AbortController();
    request<{ error?: string }>("/api/me", { signal: abort.signal })
      .then((result) => {
        if (result.status === 401) setSession("signed-out");
        else if (result.ok) setSession("signed-in");
        else throw new Error(result.data.error || "Could not verify session.");
      })
      .catch((cause) => {
        if (abort.signal.aborted) return;
        console.error("Could not check shared CAT session:", cause);
        setSession("unknown");
      });
    return () => abort.abort();
  }, [cat]);

  const claim = async () => {
    setClaiming(true);
    setStatus("Adding the CAT to your account…");
    setFailed(false);
    try {
      const data = await api<{ exam: ExamPayload }>(`/api/cat-shares/${encodeURIComponent(token)}/claim`, {
        method: "POST",
        fallbackMessage: "Could not add this CAT.",
      });
      saveCurrentExam(data.exam);
      safeRemove(KEYS.currentExamResult);
      clearAnswerDraft();
      navigate("/examinterface");
    } catch (cause) {
      console.error("Could not start shared CAT:", cause);
      setStatus(errorMessage(cause, "Could not add this CAT to your account."));
      setFailed(true);
      setClaiming(false);
    }
  };

  const query = `?sharedCat=${encodeURIComponent(token)}`;

  return (
    <div className="shared">
      <div className="shared__card">
        <p className="eyebrow">MDQ · CAT challenge</p>
        <h1 className="h2">Your classmate took the test. How would you score?</h1>

        {!cat && !failed ? <Skeleton className="skeleton--block" style={{ height: 150 }} /> : null}

        {status ? (
          failed ? (
            <Alert tone="error">{status}</Alert>
          ) : (
            <p className="muted" role="status" aria-live="polite">
              {status}
            </p>
          )
        ) : null}

        {cat ? (
          <>
            <section className="shared__result" aria-label="Shared result">
              <p className="shared__subject">
                {cat.title || "CAT"} · {cat.subject || "Medical studies"} · Year {cat.year || "N/A"}
              </p>
              <p className="shared__label">Their score</p>
              <p className="shared__score">
                {cat.totalScore}/{cat.totalMarks}
              </p>
              <p className="muted">{cat.questionCount} questions · Continuous Assessment Test</p>
            </section>

            <section className="shared__actions" aria-label="Take this CAT">
              {session === "signed-in" ? (
                <>
                  <p>Take the same CAT your classmate completed. Their answers and feedback remain private.</p>
                  <Button size="lg" block loading={claiming} iconRight="arrowRight" onClick={() => void claim()}>
                    Take the same CAT
                  </Button>
                </>
              ) : (
                <>
                  <p>Sign up to take the exact same CAT. Your classmate’s answers stay private.</p>
                  {session === "unknown" ? (
                    <Alert tone="warning">Your CAT result is visible, but we could not check your sign-in status. Refresh to try again.</Alert>
                  ) : null}
                  <ButtonLink to={`/signup${query}`} size="lg" block iconRight="arrowRight">
                    Sign up and take this CAT
                  </ButtonLink>
                  <ButtonLink to={`/login${query}`} variant="secondary" size="lg" block>
                    Already have an account? Log in
                  </ButtonLink>
                </>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
