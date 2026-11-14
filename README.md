# MDQ by Karimique — Frontend (redesign)

Medical exam-prep frontend for Kenyan MBChB students. This is a complete rebuild of the original static HTML/JS site as a
React 19 + TypeScript single-page app. **All existing backend contracts, the emerald palette, the logo and the legal text are preserved.**

## V3 — Cinematic redesign (intro + homepage)

A **visual-only** redesign of the intro and the homepage. Routes, auth, API clients, exam/CAT flows, M-Pesa, analytics,
environment variables and deployment config are untouched. The **colour palette is unchanged** (`src/styles/tokens.css` is byte-identical to V2:
emerald surfaces, mint accents and the brand gold); new lighting, glass, glow and depth effects are built only from those tokens.

**Intro — "Ascent" (8 s, `src/features/intro`, `src/features/three/introScene.ts`)** — one clock drives a real three.js scene and the DOM layers:
1. *Spark* (0–2.3 s): an ECG pulse ignites; a flash; kinetic per-letter text **"Know what you know."** as light streaks begin to accelerate.
2. *Warp + helix* (2.3–4.7 s): the camera flies through a star-field of streaks while a glowing DNA double helix of particles builds; **"Find what you don't."**
3. *Brand reveal* (4.7–6.8 s): the helix converges into a halo ring with a shockwave; the Karimique logo, a metallic **MDQ** wordmark and *"Walk into your exams prepared."* appear.
4. *Iris* (6.8–8 s): the camera dives forward and a circular opening reveals the already-mounted homepage.

Plays **on every visit** (every full load of `/`; not on in-app navigation back to the home page). **Skip intro** is visible from the first frame (also `Esc`).
`prefers-reduced-motion` gets a calm 1.8 s static brand card. No WebGL → the same sequence runs with CSS rays/streaks. The hero waits for the intro to release it, so its entrance and typewriter start as the iris opens.
`public/images/karimique_logo_glow.webp` is the existing logo converted to alpha (dark box removed) so it glows over the scene.

**Homepage (`src/features/home/HomePage.tsx`, `src/styles/home.css`)** — hero with the live 3D heart at its centre and the main features (existing feature text) **orbiting it in 3D**
(desktop and mobile; sizes use container-query units; pauses under reduced motion), a **typewriter** on the headline ("Find what you don't. Walk into your exams prepared."; full text is in the DOM for screen readers and is shown instantly under reduced motion),
3D tilt glass cards (problems, features, pricing), scroll-driven process timeline, layered-glass demo stage, animated accordion, atmospheric CTA, and **"The Vision Behind MDQ"**
directly above the footer: a rotating conic-gradient border card with two colourful, pointer-tilting 3D profile cards (teal Founder / gold Co-Founder, orbiting rings and crystals, initials only, exact supplied text).
All existing copy, prices and links are preserved.

**3D (`src/features/three`)** — plain `three` (one new dependency, no React Three Fiber/Drei/GSAP: not needed). The heart is generated **procedurally**
(deformed ellipsoids + tube curves, merged into one mesh/draw call) so there is no model download and no decoder; it is a stylised anatomical heart, not a
scanned model. three.js lives in a **lazy chunk** (~130 kB gzip) loaded off the critical path, pauses off-screen / in background tabs, caps pixel ratio,
halves particle counts on phones, shows a static SVG heart if WebGL fails, and is fully disposed on unmount.

Notes: the V2 hero mock-up (an invented exam question and a "76 %" score) was removed because the brief forbids invented results; the hero panels now show existing feature text.
Footers/credits were not changed. To replace the procedural heart with a licensed GLB later, only `src/features/three/heartScene.ts` needs to change.

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

- 8 s cinematic 3D intro on every visit to `/`, with an immediate **Skip intro** button (also Esc; ~1.8 s under reduced motion).
- Assessment set-up overlay: no fixed timer. The exam room reads the streamed question batches (`text/event-stream`) and the overlay shows the real count of questions received, phases driven by that progress, and never 100 % until the exam is ready.
- Live exam room: the exam opens as soon as the first streamed questions arrive and keeps filling in (navigator placeholders, arrival banner, Submit unlocks when complete, graceful handling of a broken stream or reload).
- Exam interface: timer (CAT 45 min / exam 135 min, auto-submit), question navigator, flagging, drafts saved per exam, double-submit guard, name capture on HTTP 428.
- Performance analytics with score-over-time chart, strengths/weaknesses, filters, full review with source passages, CAT share links.
- Accessibility: skip links, native `<dialog>` modals, focus management, labelled controls, live regions, `prefers-reduced-motion`, keyboard operable.

## Honest limitations — please read

1. **Pricing.** Kept exactly as the current frontend: **CAT KSh 30, full exam KSh 99** (`src/lib/config.ts`). The frontend never sends an amount; the **backend decides what M-Pesa actually charges**. The master brief mentioned KSh 90 for the exam — if the backend charges 90, change `PRICING.exam` in one place.
2. **Leaderboard.** The original page was "Coming soon" and no endpoint exists, so no rankings are shown.
3. **Not verified against the real backend / live M-Pesa.** Everything was exercised against the included mock only. Payment logic is a 1:1 port; confirmation relies solely on the server's `paid` status.
4. **Toolchain.** The build sandbox could not reach the npm registry, so the stack is deliberately dependency-light: React, zod, esbuild-based scripts, an in-house router and motion helpers, inline SVG icons/charts. `package-lock.json` is included (generated with `npm install`). Type-checking was done with a private minimal React type shim; with real `@types/react` installed, run `npm run typecheck` to confirm.
5. Admin user deletion uses `DELETE /api/admin/users/:id` exactly as the original did.
6. Google Fonts and the Umami analytics script load from their CDNs as in the original `index.html`.
