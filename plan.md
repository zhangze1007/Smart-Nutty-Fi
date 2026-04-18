# Nutty-Fi Submission Plan

## Summary

This plan reflects the narrowed hackathon implementation scope that is already aligned with the current codebase.

Priority order:

1. config-driven risk rules
2. structured Calm Mode reasons + citations
3. repo-seeded policy snippets with Firestore override
4. Firestore-first runtime with fallback preserved
5. explicit Pause / Continue flow
6. minimal risk logging
7. README / env / plan synchronization
8. minimal essential tests

## Implemented Direction

- Keep Vite + React frontend and Express + Genkit backend.
- Keep single Cloud Run service deployment.
- Keep Firestore as the default runtime store.
- Preserve in-memory fallback for demo continuity.
- Keep risk enforcement deterministic and server-side.

## Current Hackathon Scope

- `server/config/riskConfig.ts` provides profile-based thresholds and env/Firestore overrides.
- Calm Mode returns structured `ruleHits`, `policySummary`, `citations`, and `riskLogId`.
- Policy grounding uses repo seeds first-class in code, with Firestore `policyDocuments` override support.
- Frontend reads Firestore first, then `/api/runtime/dashboard`, then static fallback.
- Missing Firestore demo state is auto-seeded, and a small `/api/demo/reset` path restores the judging baseline on demand.
- Calm Mode modal now has explicit `Pause for now` and `Continue after review` actions.
- Calm Mode modal is touch-optimised with a capped height, independent content scrolling, and pinned footer actions for tablet/mobile Chrome.
- Minimal logging records `risk_triggered`, `risk_confirmed`, and `risk_cancelled`.
- Home screen includes lightweight Safety & Accessibility controls plus a demo-state explanation and reset action when persisted transfers are present.

## Verification

Required checks:

- `npm run lint`
- `npm run test`
- `npm run build`
- `GET /api/health`
- risky transfer -> Calm Mode
- Pause flow -> no transfer executed
- Continue flow -> transfer executed

## Deferred For Later

- runtime analytics API beyond essential dashboard fallback
- expanded intervention visualisations in `TransactionsView`
- voice prompt feature
- BigQuery integration or interface polish
- overbuilt settings persistence system
