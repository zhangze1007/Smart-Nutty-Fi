# Nutty-Fi

Nutty-Fi is a Calm Mode fintech MVP that turns a natural-language money request into an action workflow. The app keeps the Vite frontend, uses an Express + Genkit backend, and is designed for single-service Cloud Run deployment.

## What Changed For Submission

This hackathon build prioritises the highest-value judging paths:

- config-driven risk rules instead of hardcoded thresholds
- structured Calm Mode reasons with policy citations
- repo-seeded policy snippets with Firestore override
- Firestore-first runtime with fallback preserved
- explicit `Pause for now` / `Continue after review` flow
- minimal logging for `risk_triggered`, `risk_confirmed`, and `risk_cancelled`
- lightweight Safety & Accessibility controls on the home screen

## Core Flow

`chat request` -> `intent parse` -> `config-driven risk check` -> `policy lookup` -> `Calm Mode modal` -> `pause or continue` -> `transfer/log persistence`

Examples:

- risky: `Transfer RM5000 to Crypto Exchange`
- safe: `Transfer RM50 to Ali`

## Architecture

- Frontend: Vite + React
- Backend: Express + Genkit + Gemini fallback parser support
- Primary persistence: Firestore
- Fallback persistence: in-memory state when Firestore is unavailable
- Deployment: one Cloud Run service serving both API routes and the built SPA

## Risk Rules

Risk evaluation stays deterministic and server-side.

Profiles:

- `conservative`
- `balanced` (default)
- `flexible`

Default thresholds:

- `conservative`: confirm above RM500, low-balance warning below RM800
- `balanced`: confirm above RM1000, low-balance warning below RM500
- `flexible`: confirm above RM2000, low-balance warning below RM250

Other rules:

- recipient contains a configured high-risk keyword such as `crypto`, `exchange`, or `wallet`
- recipient is not in the known payee list
- projected remaining balance after upcoming bills drops below the profile threshold

## Policy Snippets

Calm Mode explanations are grounded with a small seeded policy dataset in the repo. At runtime:

- server tries Firestore collection `policyDocuments` first
- if no valid Firestore documents are available, server falls back to repo seeds

Seeded documents are short paraphrased snippets with source labels and URLs, including:

- Bank Negara Malaysia Museum and Art Gallery AMLA money-mule education
- Bank Negara Malaysia Financial Consumer Alert List
- Bank Negara Malaysia Financial Fraud Alert
- Malaysia AMLA / Act 613 reference

## API Surface

Main endpoints:

- `GET /api/health`
- `GET /api/runtime/dashboard`
- `POST /api/assistant`
- `POST /api/actions/confirm-transfer`
- `POST /api/actions/cancel-transfer`

`/api/health` reports:

- Gemini configured or missing
- runtime data mode
- policy source
- risk config source

`/api/runtime/dashboard` keeps the demo coherent when frontend Firestore reads are unavailable, so the UI can still read server runtime state instead of falling back immediately to static mock data.

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

If Firestore initialization or operations fail, the app preserves demo continuity with in-memory fallback.

## Environment Variables

Create a local `.env` from `.env.example`.

Full-path runtime:

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
- `RISK_PROFILE_BALANCED_MAX_TRANSFER_WITHOUT_CONFIRM`
- `RISK_PROFILE_BALANCED_MIN_BALANCE_THRESHOLD`
- `RISK_PROFILE_FLEXIBLE_MAX_TRANSFER_WITHOUT_CONFIRM`
- `RISK_PROFILE_FLEXIBLE_MIN_BALANCE_THRESHOLD`

Production note:

- keep `GEMINI_API_KEY` in Secret Manager
- keep Firebase Admin auth on Cloud Run through Application Default Credentials
- if sensitive overrides are not meant for build-time env vars, place them in Firestore `appConfig/risk`

## Local Development

Install dependencies:

```bash
npm install
```

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

## Test & Build

Run checks before submission:

```bash
npm run lint
npm run test
npm run build
```

The current essential tests cover:

- config-driven risk overrides
- structured risk rule hits
- repo-seeded policy fallback and Firestore override
- runtime dashboard fallback when Firestore reads fail

## Demo Script

1. Open the home screen and show the Safety & Accessibility section.
2. Keep `Balanced` risk profile selected.
3. In chat, send `Transfer RM5000 to Crypto Exchange`.
4. Show structured Calm Mode reasons and policy citations.
5. Click `Pause for now` to show that no money moves and the decision is logged.
6. Retry the transfer and click `Continue after review`.
7. Show the successful transfer response.
8. Call `/api/health` to show runtime status and configuration source.

## Cloud Run Deployment

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
- safe transfer path
- risky transfer path
- pause flow
- continue flow

## Notes

- Gemini is optional for local development. Without `GEMINI_API_KEY`, the backend falls back to deterministic intent parsing.
- Policy snippets in this repo are short paraphrases plus source metadata, not full documents.
- BigQuery and expanded analytics were intentionally deferred to reduce deployment risk for the hackathon build.
