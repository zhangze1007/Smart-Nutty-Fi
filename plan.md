# Nutty-Fi plan.md

## Goal
Ship a submission-compliant Nutty-Fi MVP that:
- uses Google AI Studio-generated frontend
- adds a minimal Genkit backend
- deploys publicly on Google Cloud Run
- provides a public GitHub repository
- supports a 3-minute demo showing chat-to-action

## Current status
### Already done
- Problem/solution direction is defined around Calm Mode and fintech risk intervention.
- Frontend prototype exists in Vite + React.
- Firebase project and Firestore were initialized.
- GitHub repository has been created and project files uploaded.
- Google AI Studio has already been used, which aligns with the Google AI ecosystem requirement.

### Gaps to close
1. Deployment target is still not Cloud Run.
2. No confirmed Genkit backend is in place yet.
3. The current stack is frontend-heavy and not yet a true “chat-to-action” agent flow.
4. README, setup instructions, and submission-oriented docs still need tightening.
5. Vertex AI Search / RAG is optional for MVP viability but useful if time remains.

## Architecture decision
Keep the current Vite frontend.
Do **not** migrate to Next.js now.

### Why
- Vite is enough for the UI, simulator, and Calm Mode flows.
- Rewriting to Next.js costs time without helping the core judging criteria much.
- Cloud Run can deploy Node.js services directly from source, including apps built from source or a Dockerfile.
- Genkit is designed for full-stack AI apps and tool-calling workflows, which is the missing piece, not a frontend rewrite.

## Target architecture
### Frontend
- Vite + React
- Existing UI from AI Studio
- Calls backend endpoints for action orchestration
- Reads/writes selected state to Firestore

### Backend
- Node.js server
- Genkit with Gemini model
- Tool-calling flow for:
  - `transfer_money`
  - `pay_bill`
  - `calculate_cashflow`
  - `risk_check`
- Optional Firestore persistence for:
  - transactions
  - risk events
  - simulation history

### Data
- Firestore collections:
  - `users`
  - `transactions`
  - `riskEvents`
  - `simulations`

### Deployment
- Public GitHub repo
- Cloud Run public URL
- Environment variables managed securely
- Firebase remains supportive infrastructure, not the final hosting target

## Minimum submission scope
### Must have
1. Public GitHub repository
2. Public Cloud Run deployment link
3. Working prototype accessible by web
4. 3-minute demo video
5. English README with setup instructions

### MVP product flows
1. **Natural-language money action**
   - User types: “Transfer RM50 to Ali”
   - Backend parses intent and prepares action
2. **Calm Mode**
   - Risk conditions trigger intervention
   - User sees clear warning + pause/continue options
3. **What-if simulator**
   - User asks about a planned purchase
   - Backend calculates short-term cashflow effect

## Execution plan
### Phase 1 — Stabilize repo
- Verify repository contains:
  - frontend source
  - package files
  - environment example
- Add a serious README:
  - project overview
  - stack
  - setup
  - local run
  - deploy notes
  - hackathon context

### Phase 2 — Add Genkit backend
- Create backend folder or service entrypoint
- Install Genkit and Gemini plugin
- Define minimal tools:
  - `transfer_money`
  - `pay_bill`
  - `calculate_cashflow`
  - `risk_check`
- Build one main flow:
  - input -> tool selection -> action result -> Calm Mode if necessary

### Phase 3 — Connect frontend to backend
- Replace mock action responses with backend API calls
- Keep UI mostly unchanged
- Ensure one full happy path works end-to-end

### Phase 4 — Firestore integration
- Store mock transaction records
- Store risk events
- Store simulation outputs
- Avoid overengineering schema

### Phase 5 — Deploy to Cloud Run
- Deploy backend + served frontend or a unified app
- Ensure public unauthenticated access
- Test on mobile browser

### Phase 6 — Submission materials
- README cleanup
- 3-minute demo recording
- Slide deck
- Cloud Run URL check
- Final GitHub verification

## Priority order
### Highest priority
1. Genkit backend
2. Cloud Run deployment
3. One complete demo flow
4. README

### Medium priority
5. Firestore persistence
6. Better UX polish
7. Spending history visuals

### Only if time remains
8. Vertex AI Search / RAG over policy docs
9. Auth
10. Android packaging

## What to avoid now
- Rewriting Vite to Next.js
- Building a native Android app first
- Complex banking integrations
- Multi-agent orchestration
- Large RAG pipeline before core flows work
- Excessive Firebase console setup

## Deliverable checklist
- [ ] GitHub repo is public
- [ ] README is in English
- [ ] Setup instructions are complete
- [ ] Genkit backend works locally
- [ ] Frontend calls backend successfully
- [ ] Calm Mode flow works
- [ ] What-if simulator works
- [ ] Firestore stores core records
- [ ] Cloud Run URL is public
- [ ] Demo video recorded
- [ ] Slides prepared
