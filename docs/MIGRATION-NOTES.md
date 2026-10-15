# Migration notes (original static site → React app)

- Routes: `/`, `/learn`, `/privacy-policy`, `/terms`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/shared-cat`,
  `/portal`, `/examroom`, `/performance`, `/leaderboard`, `/profile`, `/examinterface`, `/admin`. `.html` and `/pages/…` URLs redirect to these.
- Legal pages: text reproduced unchanged (Privacy: last updated 8 October 2026; Terms: 13 October 2026), with a contents list added.
- Palette values are the originals (`src/styles/tokens.css`); logo files are the originals plus a cropped emblem used in the header.
- Marketing preview on the home page is labelled illustrative; there are no testimonials, fake statistics or invented endorsements.
- Behaviour preserved: trial → promo → pending/reusable payment → STK push flow, drafts, timers, CAT sharing, admin delete confirmation.
- New: intro, home page (pricing + FAQ), dashboard readiness ring, performance chart, generation overlay, collapsible sidebar, mobile drawer.
- Dev-only: `dev/mock-api.mjs` (never imported by `src/`).
