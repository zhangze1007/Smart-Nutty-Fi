You are Codex working inside the Nutty-Fi repository.

Your job is to convert the current frontend-heavy prototype into a submission-compliant Google AI ecosystem MVP for the hackathon.

## Mission
Build a working **Nutty-Fi** fintech agent MVP that demonstrates the transition from **chat** to **action**.

The final system must:
1. preserve the current Vite + React frontend as much as possible
2. add a minimal **Genkit** backend using **Gemini**
3. support tool-calling based action orchestration
4. deploy publicly on **Google Cloud Run**
5. remain easy to demo in under 3 minutes

Do **not** rewrite the whole app.
Do **not** migrate the project to Next.js.
Do **not** overengineer.
Use minimal, high-leverage changes.

## Current status assumptions
- Frontend already exists as a Vite + React app generated/refined from Google AI Studio.
- Firebase project exists.
- Firestore may already be initialized.
- GitHub repo already exists.
- We need to align with hackathon requirements around:
  - Google AI ecosystem usage
  - Cloud Run deployment
  - public repository
  - working web-accessible prototype

## Core product concept
Nutty-Fi is an AI-powered “Calm” fintech agent.

It helps users:
1. perform natural-language money actions
2. receive real-time risk intervention before bad financial decisions
3. simulate short-term cashflow impact before spending

## Non-negotiable product flows
Implement these 3 flows first.

### Flow 1: Natural-language money action
Example inputs:
- "Transfer RM50 to Ali"
- "Pay my Unifi bill"

Expected behavior:
- backend parses the request
- determines intended action
- returns structured action result
- frontend displays a clear execution card

### Flow 2: Calm Mode
When a request is risky, the system must not behave like a generic chatbot.
Instead:
- trigger a risk state
- show intervention UI
- explain the concern clearly
- offer pause / continue options

Minimum risk rules can be deterministic, for example:
- amount exceeds threshold
- new payee
- suspicious merchant or destination
- insufficient balance
- spending exceeds safe monthly threshold

### Flow 3: What-if simulator
Example:
- "If I buy these headphones this month, what happens to my remaining balance?"

Expected behavior:
- calculate short-term cashflow effect
- return structured simulation result
- show predicted remaining balance and warning if needed

## Required technical direction
### Frontend
Keep the current Vite + React frontend.
Preserve the UI direction and existing views where possible.

### Backend
Add a minimal Node.js backend using **Genkit** and **Gemini**.

Use Genkit tool-calling for these tools:
- `transfer_money`
- `pay_bill`
- `calculate_cashflow`
- `risk_check`

Design one main Genkit flow that:
- receives natural language input
- selects relevant tools
- returns structured JSON output
- supports Calm Mode when risk is detected

### Data
Use Firestore only for essential persistence:
- transactions
- riskEvents
- simulations

Keep schema simple.

### Deployment
Target **Google Cloud Run**.

Build the app so it can be deployed publicly on Cloud Run.
Use the simplest viable deployment path.
If a Dockerfile is the cleanest option, create one.
If direct source deployment is cleaner, support that.
But the repository must end with a clear Cloud Run deployment path.

## IMPORTANT implementation constraints
1. Do not migrate to Next.js.
2. Do not build Android-native code.
3. Do not add unnecessary services.
4. Do not spend time on advanced auth unless truly needed.
5. Do not implement real banking APIs.
6. Prefer deterministic business logic for risk evaluation.
7. Keep the backend minimal and auditable.
8. Keep all secrets out of the repo.
9. Add or update `.env.example` properly.
10. Make the demo robust before making it fancy.

## Engineering expectations
### You must inspect the existing codebase first
Before editing, understand:
- current app structure
- routes/views/components
- current data flow
- mock logic already present
- whether there is already any Firebase usage

### Then produce an implementation plan inside the repo
Create or update:
- `plan.md`
- `README.md`

### Then make code changes
You should:
- add backend code
- wire frontend to backend
- add environment variable guidance
- add deployment guidance for Cloud Run
- keep edits minimal and coherent

## Expected repository outputs
By the end, the repo should contain at least:
- working Vite frontend
- Genkit backend
- Cloud Run deployment path
- `README.md` in English
- `.env.example`
- `plan.md`
- concise setup/run/deploy instructions

## Suggested output structure
Use something like:
- `src/` for frontend
- `server/` or `backend/` for Genkit + API
- shared config only if necessary

## README requirements
Update README so it includes:
1. project summary
2. problem statement
3. architecture overview
4. tech stack
5. local setup
6. environment variables
7. how to run frontend/backend
8. how to deploy to Cloud Run
9. demo flow summary

## Cloud Run requirement
The final app must be deployable to Cloud Run and accessible without login.

## Vertex AI Search / RAG
Treat this as optional unless the core flows are already stable.
If you add it, keep it small and clearly isolated.
Do not let RAG delay the core submission path.

## Delivery style
Work like a senior engineer under time pressure:
- inspect first
- plan second
- implement third
- document fourth

Be honest about what already exists and what still needs work.
Prefer a strong MVP over an incomplete ambitious system.

Start by:
1. auditing the existing repo structure
2. writing/updating `plan.md`
3. identifying the smallest viable Genkit backend integration
4. implementing the minimum path to Cloud Run deployment
