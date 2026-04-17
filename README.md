# Nutty-Fi

Nutty-Fi is a Calm Mode fintech MVP that turns a natural-language money request into an action workflow. The app keeps the existing Vite frontend, adds a minimal Genkit + Gemini backend, and deploys as a single public Cloud Run service.

## Problem

Banking chats often stop at conversation. Nutty-Fi pushes one step further:

- parse a money action from chat
- run a deterministic server-side risk check
- pause risky transfers with Calm Mode
- let the user explicitly confirm before execution

## Architecture

- Frontend: Vite + React
- Backend: Express + Genkit + Gemini tool-calling
- Data:
  - Firestore already exists in the Firebase project and is the default persistence layer
  - server reads and writes use Firebase Admin + Firestore by default
  - frontend reads use Firestore by default when `VITE_FIREBASE_*` config is present
  - fallback mode only exists so the demo stays usable when Firestore access or Firebase config is unavailable
- Deployment: one Node.js Cloud Run service serving both API routes and the built SPA

## Current MVP Flow

The first fully wired flow is:

`chat request` -> `intent parse` -> `deterministic risk check` -> `search_policy_guidelines` mocked RAG tool -> `Calm Mode UI` -> `confirm-transfer endpoint` -> `transaction write` -> `success response`

Examples:

- `Transfer RM5000 to Crypto Exchange`
- `Transfer RM50 to Ali`

## Genkit Tools

The backend defines these tools:

- `risk_check`
- `search_policy_guidelines`
- `transfer_money`
- `pay_bill`
- `calculate_cashflow`

Important: `risk_check` is fully deterministic and server-side. Gemini can parse intent and generate explanations, but it does not decide whether a risky transfer is allowed.

## Environment Variables

Create a local `.env` from `.env.example`.

Required for the full hackathon path:

- `GEMINI_API_KEY`

Frontend Firestore read config for Cloud Run source deploy:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional server hint:

- `FIREBASE_PROJECT_ID`

Cloud Run note:

- keep `GEMINI_API_KEY` in Secret Manager and expose it to the service as a secret-backed env var

## Local Development

Install dependencies:

```bash
npm install
```

Run the backend in one terminal:

```bash
npm run dev:server
```

Run the frontend in another terminal:

```bash
npm run dev:client
```

Frontend dev server:

- `http://localhost:3000`

Backend health check:

- `http://localhost:8080/api/health`

Notes:

- In local development, `/api/*` requests from Vite are proxied to the Express backend.
- If `GEMINI_API_KEY` is missing, the backend still starts and uses a deterministic fallback parser so the Calm Mode flow can still be tested locally.

## Production Build

Build both frontend and backend:

```bash
npm run build
```

This produces:

- frontend bundle in `dist/client`
- compiled backend in `dist/server/server`

Start the production server locally:

```bash
npm start
```

## Cloud Run Deployment

This repo is set up for Cloud Run source deployment with a supported Node LTS runtime.

Prerequisites:

- Google Cloud project with Cloud Run and Cloud Build enabled
- `gcloud` authenticated
- Firestore already exists in the Firebase project
- `GEMINI_API_KEY` stored in Secret Manager

Deploy:

```bash
gcloud run deploy nutty-fi \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars FIREBASE_PROJECT_ID=YOUR_PROJECT_ID \
  --set-build-env-vars VITE_FIREBASE_API_KEY=YOUR_API_KEY,VITE_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN,VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID,VITE_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET,VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID,VITE_FIREBASE_APP_ID=YOUR_APP_ID
```

Notes:

- Cloud Run will run `npm run build` during source deployment.
- Production starts from compiled JavaScript via `node dist/server/server/index.js`.
- Firestore already exists in the project. The app should use Firestore by default and only fall back when Firestore access is unavailable.
- On Cloud Run, server-side Firestore access should use Application Default Credentials from the service account.
- For Cloud Run source deploy, assume the `VITE_FIREBASE_*` build variables will be provided so the frontend uses Firestore reads by default.

## Firestore Fallback Contract

Frontend:

- `src/lib/dataProvider.ts`
- Firestore already exists in the project. The app should use Firestore by default and only fall back when Firestore access is unavailable.
- When `VITE_FIREBASE_*` config is present, read from Firestore first
- fall back to `mockTransactions` only if Firebase web config is missing or Firestore reads fail

Backend:

- use Firebase Admin with the default Firestore service as the primary store
- keep in-memory fallback only for local/demo resilience when Firestore access fails

## Demo Script

1. Open chat and send `Transfer RM5000 to Crypto Exchange`
2. Backend parses the request
3. Deterministic risk rules trigger Calm Mode
4. Mocked policy search tool returns grounded policy text
5. Calm Mode modal asks the user to pause or continue
6. Confirming the transfer hits `/api/actions/confirm-transfer`
7. The backend writes the transaction and returns a success response

## Verification

Validated in this repo:

- `npm run lint`
- `npm run build`
- `GET /api/health`
- risky transfer assistant response
- risky transfer confirmation response
- safe transfer response
- SPA served from the compiled Express server

## Persistence Assumption

Firestore already exists in the project. The app should use Firestore by default and only fall back when Firestore access is unavailable.
