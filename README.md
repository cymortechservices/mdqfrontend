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
- Assessment set-up overlay: no fixed timer. The exam room reads the streamed question batches (`text/event-stream`) and the overlay shows the real count of questions received, phases driven by that progress, and never 100 % until the exam is ready.
- Live exam room: the exam opens as soon as the first streamed questions arrive and keeps filling in (navigator placeholders, arrival banner, Submit unlocks when complete, graceful handling of a broken stream or reload).
- Exam interface: timer (CAT 45 min / exam 135 min, auto-submit), question navigator, flagging, drafts saved per exam, double-submit guard, name capture on HTTP 428.
- Performance analytics with score-over-time chart, strengths/weaknesses, filters, full review with source passages, CAT share links.
- Accessibility: skip links, native `<dialog>` modals, focus management, labelled controls, live regions, `prefers-reduced-motion`, keyboard operable.

## Honest limitations — please read

1. **Pricing.** Kept exactly as the current frontend: **CAT KSh 30, full exam KSh 99** (`src/lib/config.ts`). The frontend never sends an amount; the **backend decides what M-Pesa actually charges**. The master brief mentioned KSh 90 for the exam — if the backend charges 90, change `PRICING.exam` in one place.
2. **Leaderboard.** The original page was "Coming soon" and no endpoint exists, so no rankings are shown.
3. **Not verified against the real backend / live M-Pesa.** Everything was exercised against the included mock only. Payment logic is a 1:1 port; confirmation relies solely on the server's `paid` status.
4. **Toolchain.** The build sandbox could not reach the npm registry, so the stack is deliberately dependency-light: React, zod, esbuild-based scripts, an in-house router and motion helpers, inline SVG icons/charts. `package-lock.json` is **not** included — run `npm install` once to create it. Type-checking was done with a private minimal React type shim; with real `@types/react` installed, run `npm run typecheck` to confirm.
5. Admin user deletion uses `DELETE /api/admin/users/:id` exactly as the original did.
6. Google Fonts and the Umami analytics script load from their CDNs as in the original `index.html`.

---

## MDQ V3 – Cinematic redesign (intro + homepage)

Visual redesign only. Routes, auth, API calls, assessments, M-Pesa, dashboard, env variable names, `package.json` and the colour tokens (`src/styles/tokens.css`) are unchanged. All existing homepage copy, prices, FAQs, links and button labels are preserved.

**What changed**
- `src/features/intro/Intro.tsx`, `src/styles/intro.css` – ≈ 7.8 s cinematic intro (emergence → hologram scan → logo reveal → particle portal that opens onto the homepage). Skip button / Esc from the first frame; reduced motion gets a short still frame; the homepage is mounted underneath.
- `src/features/home/heart/*` – dependency-free raw-WebGL 3D heart (≈ 9 kB, lazy-loaded). Procedural anatomy: four chambers, auricles, AV and interventricular grooves, aorta with arch branches, pulmonary trunk, venae cavae, pulmonary veins and coronary arteries (brand gold), tissue-style shading in the MDQ emerald palette. Loop pauses off-screen / on hidden tabs; static SVG fallback when WebGL is missing, lost, or software-rendered.
- `src/features/home/HeroScene.tsx` – hero 3D scene with floating glass panels that reuse existing feature copy; pointer parallax on desktop.
- `src/components/ui/Tilt.tsx` – subtle 3D tilt for problem / feature / pricing cards (fine pointers only).
- `src/features/home/HomePage.tsx` – wiring: tilt cards, animated process timeline, layered demo mockups, pricing and CTA presentation.
- `src/components/ui/Feedback.tsx` – FAQ accordion now animates open/close (closed panels are `inert`).
- `src/features/home/Founders.tsx` – new “The Vision Behind MDQ” founder / co-founder card above the footer (initials monograms – no invented photos or links).
- `src/styles/cinematic.css` – all new homepage styling, imported last from `src/styles/index.css`.

**Run it** – same as before: `npm install`, `npm run dev` (or `npm run dev:mock`), `npm run check`, `npm run test:e2e`.
