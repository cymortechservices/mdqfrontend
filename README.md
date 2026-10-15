# MDQ by Karimique — Frontend (redesign)

Medical exam-prep frontend for Kenyan MBChB students. This is a complete rebuild of the original static HTML/JS site as a
React 19 + TypeScript single-page app. **All existing backend contracts, the emerald palette, the logo and the legal text are preserved.**

## Quick start

```bash
npm install          # react, react-dom, zod (+ dev tooling)
npm run dev          # http://localhost:5173  – proxies API calls to MDQ_DEV_API_TARGET if set
npm run dev:mock     # same, with a DEV-ONLY in-memory mock backend (fake data, no real services)
npm run build        # production bundle → dist/
npm run preview      # serve dist/ with SPA fallback (add -- --mock for the mock API)
npm run typecheck && npm test && npm run test:e2e
```

Requirements: Node 20+. `test:e2e` needs Chromium (`CHROMIUM_PATH`, or `PLAYWRIGHT_BROWSERS_PATH`) and runs against the production build + mock API.

## Configuration (`.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Optional. Omit for same-origin (the original behaviour). Public value only — never put secrets in `VITE_*`. |
| `MDQ_DEV_API_TARGET` | Dev/preview only: proxy API requests to a real backend. |

Auth is the existing **session cookie** (`credentials: "include"`); no tokens are stored in the browser.

## Deployment

Any static host with an SPA fallback. `vercel.json` is included: GET navigations with `Accept: text/html` fall back to `index.html`,
**API paths are never rewritten** (several page URLs share their path with a POST API route, e.g. `/login`, `/signup`).
Legacy URLs (`/pages/login.html`, `/portal.html`, …) are canonicalised to clean routes client-side.

## What is in here

- `src/app` routing, error boundary, intro gating · `src/features/*` pages by feature · `src/layouts` public / auth / app (collapsible sidebar) / admin
- `src/lib` API client, storage, validation (zod), exam + score maths ported 1:1 from the original · `src/components` UI primitives, charts, brand
- `src/styles` design tokens + CSS (no framework) · `dev/mock-api.mjs` dev-only mock · `tests/` unit tests · `e2e/run.mjs` browser smoke test
- `docs/API-CONTRACTS.md`, `docs/MIGRATION-NOTES.md`

## Highlights

- ~9 s cinematic intro on entry at `/` with an immediate **Skip intro** button (also Esc; ~1.8 s under reduced motion). Plays once per page load.
- Assessment generation overlay: CAT ≈ 4 min, full exam ≈ 8 min — phases, estimated progress (never 100 % until the server answers, and says so),
  study-tip carousel, breathing pacer, reload warning.
- Exam interface: timer (CAT 45 min / exam 135 min, auto-submit), question navigator, flagging, drafts saved per exam, double-submit guard, name capture on HTTP 428.
- Performance analytics with score-over-time chart, strengths/weaknesses, filters, full review with source passages, CAT share links.
- Accessibility: skip links, native `<dialog>` modals, focus management, labelled controls, live regions, `prefers-reduced-motion`, keyboard operable.

## Honest limitations 

1. **Pricing.** Kept exactly as the current frontend: **CAT KSh 30, full exam KSh 99** (`src/lib/config.ts`). The frontend never sends an amount; the **backend decides what M-Pesa actually charges**.
2. **Leaderboard.** The original page was "Coming soon" and no endpoint exists, so no rankings are shown.
3. **Not verified against the real backend / live M-Pesa.** Everything was exercised against the included mock only. Payment logic is a 1:1 port; confirmation relies solely on the server's `paid` status.
4. Admin user deletion uses `DELETE /api/admin/users/:id` exactly as the original did.
5. Google Fonts and the Umami analytics script load from their CDNs as in the original `index.html`.
