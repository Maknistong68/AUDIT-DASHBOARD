# Deployment

The app has no database, no accounts and no server-side storage. It builds
to a standard Next.js application and runs on the built-in dataset, so
deployment is one step.

## Vercel

**Add New Project → Import** this repository. Framework preset: Next.js;
no other build settings and **no environment variables**. Deploy.

The first visit lands on `/welcome`, which asks for a display name and a
role and writes them to a single `demo_profile` cookie. Every other route
requires that cookie. "Restart demo" (top right) deletes it.

## Local

```bash
npm install
npm run dev          # http://localhost:3000
```

To check a production build the way Vercel runs it, kill any old
`next-server` on the port first — a stale one serves the previous build:

```bash
npm run build && npm start
```

## What is stored where

| Data | Where it lives | Leaves the browser? |
|---|---|---|
| Display name + role | `demo_profile` cookie, `httpOnly`, 30 days | Only as a cookie header |
| Reviews you create or edit | `localStorage` | No |
| The baseline dataset | compiled into the bundle | n/a |

Nothing is written to a server. Clearing site data returns the app to the
baseline dataset.

## Before this carries real audit data

Read `docs/COMPLIANCE-KSA.md` first. The short version: the demo is
hostable anywhere because it holds no real data, but a deployment carrying
**real Oxagon contractor results is NEOM data** and belongs inside the
Kingdom under an approved hosting arrangement — that is a hosting decision,
not a code change.

## Verifying a deployment

- A fresh browser lands on `/welcome` and cannot reach any other route.
- After onboarding, the dashboard shows 11 contractors, four quarters and a
  programme average near 83%.
- `Al Fahd (1272)`'s Q3 2026 review reads 60.85% on the H&S checklist —
  that is the source workbook's own audit, reproduced exactly.
- Choosing the **Admin** role reveals the Reference page; **Viewer** hides
  every save control.
