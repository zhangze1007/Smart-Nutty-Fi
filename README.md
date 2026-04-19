# Nutty-Fi

Nutty-Fi is a decision-intervention layer for risky digital money actions.

This submission turns a natural-language money request into a structured action flow with server-side risk evaluation, Calm Mode intervention, Malaysia-grounded policy context, and an explicit pause-or-continue decision path. The current build keeps the Vite + React frontend, runs an Express + Gemini-backed backend, uses Firestore first with fallback preserved, and deploys as a single Cloud Run service.

## Submission Snapshot

- Focus: safer money movement before risky transfers are completed
- Core differentiator: structured intervention instead of a generic confirmation banner
- Demo path: safe transfer, risky transfer, what-if simulator, policy context
- Deployment model: one Cloud Run service serving both API routes and the built SPA

## Problem

Digital money actions are fast, easy, and often irreversible. A risky transfer should not rely on a simple confirmation button when users may be sending money to an unknown payee, a high-risk destination, or from an already constrained balance. This matters for students managing a monthly allowance, everyday e-wallet users, cautious older family members, and anyone who may rush through a payment request on mobile.

## Solution

Nutty-Fi adds a decision-intervention layer before risky money movement:

- natural-language money actions for transfer, bill review, and what-if intents
- deterministic server-side risk evaluation
- Calm Mode intervention when a transfer needs review
- policy-backed explanation with citations
- explicit `Pause and review later` or `Continue and move money` decision flow

## Who It Helps

- students and young adults who need a clearer pause before sending money to a first-time payee
- everyday e-wallet or banking-app users who may be pushed into rushed transfers
- cautious or older users who want a plain-language checkpoint before confirming
- financially vulnerable users who need to see whether a transfer leaves too little for upcoming bills

## Key Flows

- Safe transfer: low-risk request moves through without Calm Mode interruption
- Risky transfer with Calm Mode: server-side rules trigger a review checkpoint before money moves
- What-if simulator: user can preview short-term balance impact before spending
- Policy context: Calm Mode explanations are grounded in seeded or Firestore-backed Malaysia-specific policy snippets

## Architecture

- Frontend: Vite + React
- Backend: Express + Gemini-backed flow with deterministic risk logic
- Data: Firestore-first runtime with in-memory fallback preserved for demo continuity
- Deployment: single Google Cloud Run service for API routes and the built SPA

## Realistic Adoption Paths

Nutty-Fi is still an MVP, so the credible adoption story is narrow:

- E-wallet safety layer: the current flow can sit in front of a transfer confirmation step as a review layer for higher-risk sends, especially first-time payees or suspicious destinations.
- Banking or sandbox integration path: a next step would be connecting the same checkpoint logic to sandbox transaction APIs or payee-verification signals while keeping the ledger and settlement system outside this product.
- Premium safety or coaching layer: the existing risk profiles, Calm Mode history, and what-if checks could support an optional paid safety tier for users who want stronger guardrails or more deliberate money coaching.
- Fraud-prevention analytics path: the current MVP already logs triggered, confirmed, and cancelled interventions. A realistic next layer would summarize those events for product or risk teams instead of claiming full fraud detection coverage.

What this build does not claim today:

- live bank or e-wallet integrations
- real payment execution outside the demo runtime
- bank-grade fraud scoring or case management
- production-scale analytics infrastructure

## Submission Focus

This hackathon build prioritizes the judging-critical path:

- config-driven risk rules instead of hardcoded thresholds
- structured Calm Mode reasons with policy citations
- repo-seeded policy snippets with Firestore override support
- Firestore-first runtime with fallback preserved
- explicit `Pause and review later` / `Continue and move money` path
- reproducible demo reset flow
- lightweight safety and accessibility controls on the home screen
- minimal risk logging for key intervention outcomes

## Inclusion Notes

- Calm Mode keeps the decision explicit: pause or continue after review
- rule explanations stay plain-language and short enough to scan on mobile
- the home screen includes a large-text toggle as a lightweight readability aid for the demo
- this MVP does not claim multilingual support, assisted reading, or broader accessibility coverage beyond those lightweight controls

## Core Flow

`chat request` -> `intent parse` -> `server-side risk check` -> `policy lookup` -> `Calm Mode checkpoint` -> `pause or continue` -> `transfer/log persistence`

Examples:

- risky: `Transfer RM5000 to Crypto Exchange`
- safe: `Transfer RM50 to Ali`
- what-if: `If I spend RM350 this month, what happens to my remaining balance?`

## Risk Profiles

Risk evaluation stays deterministic and server-side.

Profiles:

- `conservative`
- `balanced` (default)
- `flexible`

Default thresholds:

- `conservative`: confirm above RM500, low-balance warning below RM800, first-time payee review at any amount
- `balanced`: confirm above RM1000, low-balance warning below RM500, first-time payee review from RM100
- `flexible`: confirm above RM2000, low-balance warning below RM250, first-time payee review from RM300

Other review conditions:

- recipient contains a configured high-risk keyword such as `crypto`, `exchange`, or `wallet`
- recipient is not in the known payee list and crosses the selected profile's first-time payee threshold
- projected remaining balance after upcoming bills drops below the selected profile threshold

## Policy Context

Calm Mode explanations are grounded with a small Malaysia-focused policy dataset in the repo. At runtime:

- server tries Firestore collection `policyDocuments` first
- if no valid Firestore documents are available, server falls back to repo seeds

Seeded documents are short paraphrased Malaysia references with source labels and URLs, including:

- Bank Negara Malaysia money mule education
- Bank Negara Malaysia Financial Consumer Alert List
- Bank Negara Malaysia Financial Fraud Alert
- Malaysia Act 613 AMLA reference

These snippets support Calm Mode explanations and demo citations. They are not legal advice and do not mean Nutty-Fi performs a regulatory determination.

## API Surface

Main endpoints:

- `GET /api/health`
- `GET /api/runtime/dashboard`
- `POST /api/demo/reset`
- `POST /api/assistant`
- `POST /api/actions/confirm-transfer`
- `POST /api/actions/cancel-transfer`

`/api/health` reports:

- Gemini configured or missing
- runtime data mode
- policy source
- risk config source

`/api/runtime/dashboard` keeps the demo coherent when frontend Firestore reads are unavailable, so the UI can still read server runtime state instead of falling back immediately to static mock data.

`POST /api/demo/reset` restores the seeded RM4250.00 baseline, rewrites demo transactions, and clears transient risk logs so the judging flow starts from a clean state.

## Data & Logging

Firestore-first collections/documents used by this build:

- `appState/demo`
- `transactions`
- `logs`
- `policyDocuments`
- `simulations`

Risk logs written by the server:

- `risk_triggered`
- `risk_confirmed`
- `risk_cancelled`

These events are enough to support a demo dashboard, explain intervention outcomes, and illustrate how an eventual product team could review checkpoint behavior. They are not a substitute for a production fraud-monitoring pipeline.

If Firestore is available but `appState/demo` is missing, the server seeds a reproducible baseline automatically. If Firestore initialization or operations fail, the app preserves demo continuity with in-memory fallback.

When previous demo transfers are still present, the home screen auto-resets to the seeded baseline on first load for a cleaner judging start and still keeps a manual reset action for the live demo flow.

## Setup Instructions

### Prerequisites

- Node.js `22.x`
- npm
- a Google Cloud / Firebase project if you want the full Firestore-backed runtime

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a local `.env` from `.env.example`.

Required runtime key:

- `GEMINI_API_KEY`

Optional server hint:

- `FIREBASE_PROJECT_ID`

Optional frontend Firestore config:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional risk configuration overrides:

- `RISK_DEFAULT_PROFILE`
- `RISK_HIGH_RISK_KEYWORDS`
- `RISK_UNKNOWN_PAYEE_REQUIRES_REVIEW`
- `RISK_PROFILE_CONSERVATIVE_MAX_TRANSFER_WITHOUT_CONFIRM`
- `RISK_PROFILE_CONSERVATIVE_MIN_BALANCE_THRESHOLD`
- `RISK_PROFILE_CONSERVATIVE_UNKNOWN_PAYEE_MINIMUM_AMOUNT`
- `RISK_PROFILE_CONSERVATIVE_UNKNOWN_PAYEE_SEVERITY`
- `RISK_PROFILE_CONSERVATIVE_HIGH_RISK_KEYWORD_SEVERITY`
- `RISK_PROFILE_BALANCED_MAX_TRANSFER_WITHOUT_CONFIRM`
- `RISK_PROFILE_BALANCED_MIN_BALANCE_THRESHOLD`
- `RISK_PROFILE_BALANCED_UNKNOWN_PAYEE_MINIMUM_AMOUNT`
- `RISK_PROFILE_BALANCED_UNKNOWN_PAYEE_SEVERITY`
- `RISK_PROFILE_BALANCED_HIGH_RISK_KEYWORD_SEVERITY`
- `RISK_PROFILE_FLEXIBLE_MAX_TRANSFER_WITHOUT_CONFIRM`
- `RISK_PROFILE_FLEXIBLE_MIN_BALANCE_THRESHOLD`
- `RISK_PROFILE_FLEXIBLE_UNKNOWN_PAYEE_MINIMUM_AMOUNT`
- `RISK_PROFILE_FLEXIBLE_UNKNOWN_PAYEE_SEVERITY`
- `RISK_PROFILE_FLEXIBLE_HIGH_RISK_KEYWORD_SEVERITY`

Production notes:

- keep `GEMINI_API_KEY` in Secret Manager
- keep Firebase Admin auth on Cloud Run through Application Default Credentials
- if sensitive overrides are not meant for build-time env vars, place them in Firestore `appConfig/risk`

### Local Run

Run the backend:

```bash
npm run dev:server
```

Run the frontend:

```bash
npm run dev:client
```

Useful local URLs:

- frontend: `http://localhost:3000`
- backend health: `http://localhost:8080/api/health`

### Validation Checks

Run checks before submission:

```bash
npm run lint
npm run test
npm run build
```

Current essential automated coverage includes:

- config-driven risk overrides
- structured risk rule hits
- repo-seeded policy fallback and Firestore override
- runtime dashboard fallback when Firestore reads fail
- demo reset restoring the seeded baseline and auto-resetting stale first-load demo data for judging

### Deploy Overview

The deployment model stays unchanged: one Node service, source-based deploy, compiled server startup.

Example:

```bash
gcloud run deploy nutty-fi \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars FIREBASE_PROJECT_ID=YOUR_PROJECT_ID \
  --set-build-env-vars VITE_FIREBASE_API_KEY=YOUR_API_KEY,VITE_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN,VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID,VITE_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET,VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID,VITE_FIREBASE_APP_ID=YOUR_APP_ID
```

Cloud Run validation after deploy:

- `GET /api/health`
- `POST /api/demo/reset`
- safe transfer path
- risky transfer path
- pause flow
- continue flow

## Demo Script

1. Open the home screen and show the safety controls.
2. Keep `Balanced` risk profile selected.
3. In chat, send `Transfer RM5000 to Crypto Exchange`.
4. Show Calm Mode reasons, rule hits, and policy citations.
5. Click `Pause and review later` to show that no money moves and the decision is logged.
6. Retry the transfer and click `Continue and move money`.
7. Show the successful transfer response.
8. Use `Reset demo` if needed to restore the seeded baseline.
9. Call `/api/health` to show runtime status and configuration source.

## AI Tooling Disclosure

- The primary development workflow for this project used Google AI Studio and Google Antigravity.
- The final prototype is deployed on Google Cloud Run.
- Additional AI assistance, if any, was limited to support tasks such as code explanation, debugging suggestions, and refinement.
- All final implementation decisions and submission materials were reviewed and understood by the team.

## Development & Deployment Evidence

- Public GitHub repository: `https://github.com/zhangze1007/Smart-Nutty-Fi`
- Live deployment on Google Cloud Run: `https://nutty-fi-vegvouariq-uc.a.run.app`
- The video demo shows both the codebase and the live prototype

## Notes

- Gemini is optional for local development. Without `GEMINI_API_KEY`, the backend falls back to deterministic intent parsing.
- Bill intents are review-only in this hackathon build; Nutty does not execute bill payments.
- Policy snippets in this repo are short paraphrases plus source metadata, not full documents.
- BigQuery and expanded analytics were intentionally deferred to reduce deployment risk for the hackathon build.
