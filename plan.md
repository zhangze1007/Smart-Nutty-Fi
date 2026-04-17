# Nutty-Fi Calm Mode MVP Plan

## Summary

- Keep the Vite + React frontend. Do not migrate to Next.js.
- Use one Express service for both API routes and the built SPA.
- Target Cloud Run with a supported Node LTS runtime.
- Compile backend TypeScript to JavaScript before production startup.
- Make risk enforcement deterministic and server-side.
- Include a mocked `search_policy_guidelines` tool so the codebase contains the required grounded RAG architecture for hackathon judging.

## Mandatory Constraints Applied

### Runtime

- `package.json` uses Node `22.x`
- production start uses compiled JavaScript, not `tsx`

### Build Strategy

- frontend builds with Vite into `dist/client`
- backend compiles with `tsc` into `dist/server/server`
- production entrypoint is `node dist/server/server/index.js`

### Security Core

- Gemini parses intent and generates explanations
- hardcoded backend rules decide whether a transfer is risky
- `risk_check` remains deterministic and server-side

### RAG Placeholder

- `search_policy_guidelines` is implemented as a Genkit tool
- risky Calm Mode flows trigger policy retrieval through this tool
- current implementation returns mocked policy guidance
- this keeps the architecture ready for future Vertex AI Search integration

## First End-to-End Flow

Implemented path:

`chat request` -> `intent parse` -> `deterministic risk check` -> `search_policy_guidelines` -> `Calm Mode UI` -> `confirm-transfer endpoint` -> `transaction write` -> `success response`

Exact risky example:

- `Transfer RM5000 to Crypto Exchange`

Exact safe example:

- `Transfer RM50 to Ali`

## Data Architecture

Frontend read path:

- `src/data/mockTransactions.ts`
- `src/lib/firebase.ts`
- `src/lib/dataProvider.ts`
- Firestore available -> use Firestore
- otherwise -> use mock data

Backend write path:

- Firebase Admin + Firestore when available
- otherwise -> use in-memory fallback

Collections used:

- `transactions`
- `riskEvents`
- `simulations`
- `appState/demo`

## Backend Design

- Genkit model: `gemini-2.5-flash`
- tools:
  - `risk_check`
  - `search_policy_guidelines`
  - `transfer_money`
  - `pay_bill`
  - `calculate_cashflow`
- routes:
  - `GET /api/health`
  - `POST /api/assistant`
  - `POST /api/actions/confirm-transfer`

Deterministic transfer risk rules:

- amount `>= 1000`
- payee contains `crypto` or `exchange`
- payee is not in the known payee list
- projected remaining balance after upcoming bills and the transfer is `< 500`

## Frontend Changes

- fixed `src/component` vs `src/components` mismatch
- removed client-side Gemini key exposure from Vite config
- replaced mocked chat keyword logic with `/api/assistant`
- kept Calm Mode modal in `App.tsx`
- moved dashboard and transactions reads onto `dataProvider`

## Verification Targets

- `npm run lint`
- `npm run build`
- compiled server starts successfully
- risky transfer returns Calm Mode payload
- confirm-transfer completes the risky transfer
- safe transfer completes without Calm Mode
- SPA is served by the Express server

## Next Upgrade Path

When time allows, the next incremental improvement is to replace the mocked `search_policy_guidelines` tool body with a real Vertex AI Search or Discovery Engine retrieval call while keeping the rest of the flow unchanged.
