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
| `POST /api/generate-test` (multipart: test-type, year, subject, topic, promoCode, materials[], paymentId?) | Exam room | takes ~4 min (CAT) / ~8 min (exam) |
| `POST /api/exams/:id/confirm-delivery` | Exam interface | paid exams, retryable |
| `POST /api/submit-exam` `{examId,answers}` | Exam interface | 428 name flow |
| `POST /api/cat-shares` `{attemptId}` → `{token}`; `GET /api/cat-shares/:token`; `POST /api/cat-shares/:token/claim` | Performance, Shared CAT | |
| `GET /api/admin/users`, `DELETE /api/admin/users/:id` | Admin | 403 handled |

localStorage keys are unchanged (`currentExam`, `currentExamAnswers`, `currentExamResult`, `mdqPendingPayment:<type>`).
Page routes share paths with some POST routes; hosts must only apply the SPA fallback to GET/HEAD with `Accept: text/html` and never to `/api/*`.
