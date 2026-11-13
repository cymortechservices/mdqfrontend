# Backend contracts used by the frontend

No endpoint was invented. All calls are same-origin (or `VITE_API_BASE_URL`) with `credentials: "include"`.

| Method & path | Used by | Notes |
|---|---|---|
| `POST /login` `{studentEmail,password}` | Login | 403 + "Verify your student email before logging in." → resend flow |
| `POST /logout` | Layouts | |
| `POST /signup`, `/verify-email`, `/resend-verification`, `/request-password-reset`, `/reset-password` | Auth pages | payloads unchanged |
| `GET /api/me` → `{user}` | Session check | 401/403 → anonymous; other errors → retry screen |
| `PUT /api/me/name` `{displayName}` | Exam submit | after 428 `{nameRequired:true}` |
| `GET /api/exams` → `{exams[]}` | Dashboard, Performance | |
| `GET /api/exam-trials` → `{available:{cat,exam}}` | Dashboard, Exam room | |
| `POST /api/promo-codes/validate` `{code}` | Exam room | `{valid,available}` |
| `GET /api/payments/reusable/:type`, `POST /api/payments/stk-push` `{phoneNumber,testType}`, `GET /api/payments/:id/status` | Exam room | polled every 3 s, max 60×; only server `paid` counts |
| `POST /api/generate-test` (multipart: test-type, year, subject, topic, promoCode, materials[], paymentId?) | Exam room | responds as `text/event-stream` (question batches); a single JSON body is still accepted. See "Streaming" below |
| `POST /api/exams/:id/confirm-delivery` | Exam interface | paid exams, retryable |
| `POST /api/submit-exam` `{examId,answers}` | Exam interface | 428 name flow |
| `POST /api/cat-shares` `{attemptId}` → `{token}`; `GET /api/cat-shares/:token`; `POST /api/cat-shares/:token/claim` | Performance, Shared CAT | |
| `GET /api/admin/users`, `DELETE /api/admin/users/:id` | Admin | 403 handled |

localStorage keys are unchanged (`currentExam`, `currentExamAnswers`, `currentExamResult`, `mdqPendingPayment:<type>`).
Page routes share paths with some POST routes; hosts must only apply the SPA fallback to GET/HEAD with `Accept: text/html` and never to `/api/*`.


## Streaming: `POST /api/generate-test`

The exam room sends `Accept: text/event-stream` and reads the response incrementally (`src/features/exams/assessmentStream.ts`).
The overlay has no fixed timer; it shows the number of questions received so far (and a percentage only if the server announces a total).

The exact event schema is owned by the backend, so the reader is tolerant. Each event carries JSON in `data:`; the name comes from `event:` (or a `type` field):

| Purpose | Accepted shapes |
|---|---|
| Metadata | `examId`, `title`, `subject`, `year`, `examType`… at top level or in `meta`/`data` |
| Question batch | `{ "mcqs": [...] }`, `{ "saqs": [...] }`, `{ "essay": [...] }`, or `{ "questions": [...] }` (routed by event/section name, default MCQ). Duplicate ids are ignored |
| Expected total | numeric `total` / `expected` / `totalQuestions` / `plannedQuestionCount` (optional; when absent MDQ's promised size is used: 50 for a CAT, 94 for a full exam) |
| Completion | event `done`/`complete`/`end`/`final`, or `{ "done": true }`. Without one, a normal close counts as complete only if every announced total arrived. An `exam` object is merged like a batch and is never taken as "finished" |
| Failure | event `error`, or `{ "error": "message" }` |

The exam interface opens on the FIRST batch and shows every later batch as it lands (`liveAssessment.ts` keeps the stream running across the navigation). The countdown starts when the first questions appear, the navigator shows "on the way" placeholders when a total was announced, and Submit unlocks only after the stream completes. If the connection breaks or the page is reloaded mid-stream, the student keeps the questions that arrived and can submit those (a notice says so). `currentExam` in localStorage is updated after every batch and flagged `streaming: true` until the last one.
If the real event format differs, only `applyMessage()` needs adjusting.

## Student email
The signup form accepts any university address (`*.ac.xx`, `*.edu`, `*.edu.xx`) plus the original allow-list; the backend must accept the same.

### Submit lock
Submit (top bar, pager and the review dialog) is disabled and dimmed until every question has arrived AND has an answer. Only the countdown reaching zero submits regardless, so a student never loses their work.

### If the stream seems to stop after the first batch
The client keeps reading until the server closes the connection or sends `done`. If the server itself stops after one batch, check that it does not end generation on `req.on("close")` (in Node 16+ that fires once the request body is read, not when the client leaves; use `res.on("close")`), and that no proxy buffers or times out the response (set `VITE_API_BASE_URL` to the backend directly if a proxy interferes).

### Never closes the connection early
The reader never cancels the request because of an `error` field or a surprising event: an error is only remembered (it is forgotten as soon as more questions arrive, so a "chunk retry" notice is harmless). Unreadable events are skipped. The stream is complete only when the target count is reached AND the server said `done` or closed normally; once complete the reader stops. A stream that ends short (dropped connection, proxy timeout) is reported as "Only N of M questions arrived" and the student keeps what arrived.

If production logs show `connection_closed_early` while the browser did not leave the page, an intermediary closed the response. Send a comment line (`: keepalive\n\n`) every ~10-15 s while waiting for the model, and for a reverse proxy use `proxy_buffering off; proxy_read_timeout 600s;` (nginx) for `/api/generate-test`.

### Clock and submission
- The countdown starts at the instant the first question arrives (`liveAssessment.ts` stamps `startedAt`; nothing is read back from an earlier exam). Reloading resumes from the stored `startedAt`.
- The timer turns red and flashes only in the last 10 seconds. At zero the answers are submitted automatically, whatever is unanswered.
- There is no "Submission failed" banner. A failed submit is retried quietly (always after time-up; 4 attempts for a manual submit). Only a clear server rejection (HTTP 4xx other than 408/425/429) stops the retries, and is logged to the console.
