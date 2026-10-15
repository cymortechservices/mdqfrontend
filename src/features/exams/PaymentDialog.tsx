import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { Alert, Spinner } from "../../components/ui/Feedback";
import { ASSESSMENTS, formatPrice, type TestType } from "../../lib/config";
import { cleanPhone, isKenyanMobile } from "../../lib/validation";

export interface PaymentRequest {
  testType: TestType;
  amount: number;
  resolve: (phone: string | null) => void;
}

/** Step 1 of paying: confirm the price and choose the M-Pesa number. Nothing is charged until the student approves the prompt on their phone. */
export function PaymentConfirmDialog({ request }: { request: PaymentRequest | null }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (request) {
      setError(undefined);
    }
  }, [request]);

  if (!request) return <Dialog open={false} onClose={() => {}} title="" />;
  const label = ASSESSMENTS[request.testType].label.toLowerCase();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isKenyanMobile(phone)) {
      setError("Enter a Kenyan M-Pesa number, for example 0712345678 or 0117696933.");
      return;
    }
    request.resolve(cleanPhone(phone));
  };

  return (
    <Dialog
      open
      size="sm"
      onClose={() => request.resolve(null)}
      title={`Pay ${formatPrice(request.amount)} for this ${label}`}
      description="You’ve used your free trial for this assessment type. Pay once for this assessment with M-Pesa."
      initialFocusId="mpesa-phone"
    >
      <form onSubmit={submit} className="form" noValidate>
        <TextField
          id="mpesa-phone"
          label="M-Pesa number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712345678"
          icon="smartphone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          hint="This number receives the payment prompt. MDQ never asks for your M-Pesa PIN."
          error={error}
          required
        />
        <div className="dialog__actions">
          <Button type="button" variant="ghost" onClick={() => request.resolve(null)}>
            Cancel
          </Button>
          <Button type="submit" iconRight="arrowRight">
            Send M-Pesa prompt · {formatPrice(request.amount)}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Step 2: waiting for the student to approve the prompt. Confirmation comes only from the server's payment status. */
export function PaymentWaitingDialog({
  progress,
  onStop,
}: {
  progress: { attempt: number; max: number } | null;
  onStop: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const open = progress !== null;
  useEffect(() => {
    if (!open) {
      setSeconds(0);
      return undefined;
    }
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  return (
    <Dialog open={open} onClose={() => {}} dismissible={false} size="sm" title="Waiting for your payment" description="Check your phone and approve the M-Pesa prompt.">
      <div className="pay-wait" role="status" aria-live="polite">
        <Spinner size="lg" />
        <p>
          We’re confirming your payment with M-Pesa. This usually takes under a minute.
          <span className="muted"> Checked {progress?.attempt ?? 0} of {progress?.max ?? 0} times · {seconds}s</span>
        </p>
      </div>
      <Alert tone="info">If you close the page, your payment is saved. Press START again and you won’t be charged twice.</Alert>
      <div className="dialog__actions">
        <Button variant="secondary" onClick={onStop}>
          Stop waiting
        </Button>
      </div>
    </Dialog>
  );
}
