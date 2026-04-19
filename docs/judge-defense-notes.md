# Nutty-Fi Judge Defense Notes

## What problem this solves

Digital money actions happen fast, but risky transfers often still rely on a simple confirm button. Nutty-Fi adds a decision-intervention layer before money moves, so the user gets a pause, a reason, and a clearer review step before a risky transfer goes through.

## Why this is not a standard e-wallet warning

Nutty-Fi does not show the same warning for every transfer. It:

- parses a natural-language request into a money action
- runs deterministic server-side risk checks before transfer execution
- adjusts review behavior by risk profile
- explains the checkpoint with policy-backed context
- gives the user a real pause-or-continue path that is logged

## Main transfer flow

1. User describes a transfer in natural language.
2. Server resolves intent and requested amount/recipient.
3. Server-side risk rules evaluate the transfer against threshold, destination, known payee, and remaining balance checks.
4. If the transfer looks safe, it completes normally.
5. If the transfer looks risky, Calm Mode opens with rule hits, severity, and policy-backed explanation.
6. User either pauses or deliberately continues.
7. Outcome is recorded so the review path is part of the product flow, not just UI decoration.

## What Calm Mode does

Calm Mode is the checkpoint layer. It shows:

- why intervention happened
- which rules were hit
- whether the checkpoint is medium or high severity
- policy-backed context for the explanation
- an explicit pause or continue decision

The goal is to slow down risky money movement without blocking normal transfers unnecessarily.

## What Firestore stores

Firestore is the preferred runtime store for the MVP. It keeps:

- `appState/demo` for current balance, bills, known payees, and demo-state metadata
- `transactions` for recent money movement shown in the app
- `logs` for risk-triggered, confirmed, and cancelled review outcomes
- `simulations` for what-if calculator runs
- `policyDocuments` for optional policy snippet overrides
- `appConfig/risk` for optional risk-profile overrides

If Firestore is unavailable, the app falls back to in-memory demo state so the prototype still works during judging.

## How policy context is used

Policy context is not decorative copy. When a risky transfer is detected, the backend maps rule hits to policy topics, ranks seeded or Firestore-backed snippets, and uses those snippets to support the Calm Mode explanation and citations.

## Known MVP limitations

- Risk detection is intentionally simple and rule-driven, not bank-grade fraud scoring.
- Policy coverage is limited to a small seeded dataset plus optional Firestore overrides.
- The product is a single-user demo prototype, not a multi-account banking system.
- There is no real bank integration; transfer execution is simulated inside the prototype runtime.
