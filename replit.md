# Afeeyah AI

Afeeyah AI is a WhatsApp health information assistant for people and families in Nigeria. It answers common health questions, supports women and family health education, and helps users recognise when to seek professional or emergency care. Finding specific healthcare facilities is a planned feature and is not available yet.

## Run & Operate

- Install the existing workspace with `pnpm install --frozen-lockfile`.
- In Replit, run the managed workflows `artifacts/api-server: API Server` and `artifacts/materna-dashboard: web`. They provide the required `PORT` and `BASE_PATH` settings automatically.
- Open the Afeeyah AI dashboard preview at `/`; the API is available at `/api`, with a health check at `/api/healthz`.
- To connect WhatsApp, open WhatsApp on the intended phone, go to **Linked devices → Link a device**, and scan the live QR code shown in the dashboard.
- Groq is selected first when its key is present; NVIDIA is selected when neither Groq nor Grok is configured. Provider errors do not automatically switch providers.
- The dashboard and session/connection-control endpoints currently have no sign-in protection. Keep this as a development setup; add access controls before publishing with real user data.
- `pnpm --filter @workspace/api-server run dev` — run the API server and Afeeyah AI WhatsApp connection
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Optional env: `GROQ_API_KEY` or `NVIDIA_API_KEY` — enables live health-information responses (Groq preferred)
- Optional env: `PAYSTACK_SECRET_KEY` — enables secure doctor-booking payment links
- Optional env: `MATERNA_AUTH_DIR` — Baileys auth directory (defaults to `data/materna-auth`)
- Optional env: `MATERNA_SESSION_FILE` — JSON session store path (defaults to `data/materna-sessions.json`)

## Railway

- The root `Dockerfile` builds the dashboard and API together; the API serves the dashboard at `/` and the API at `/api`.
- `railway.toml` selects the Dockerfile, starts the API, and checks `/api/healthz`.
- Attach a persistent Railway volume at `/data` so WhatsApp pairing and JSON-backed sessions survive restarts.
- Add `GROQ_API_KEY` or `NVIDIA_API_KEY` as Railway service variables for live AI responses. Replit Secrets are not copied to Railway.
- Railway's documentation says `railway.toml` config-as-code is deprecated and is expected to stop working on December 1, 2026. Migrate to Railway Infrastructure as Code before then.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/materna/whatsapp.ts` — Baileys connection, QR pairing, and WhatsApp message intake
- `artifacts/api-server/src/materna/conversationFlow.ts` — consent, status, menu, Q&A, and booking state machine
- `artifacts/api-server/src/materna/sessionStore.ts` — lightweight JSON-backed session state
- `artifacts/api-server/src/materna/aiHandler.ts` — Groq/Grok/NVIDIA-compatible health-information prompt and provider calls
- `artifacts/api-server/src/materna/payment.ts` — available doctor slots and Paystack initialization
- `artifacts/api-server/src/routes/materna.ts` — status, session inspection, and local conversation preview endpoints

## Architecture decisions

- Baileys multi-file auth is used for the MVP so the WhatsApp QR pairing can persist across restarts.
- Session state is intentionally JSON-backed and lightweight; it is not a substitute for production clinical data storage.
- AI provider selection is explicit: Groq is preferred, then Grok, then NVIDIA; none is silently replaced with a fake answer.
- Paystack is initialized only when `PAYSTACK_SECRET_KEY` exists; booking never asks users to send card details in WhatsApp.
- The AI system prompt limits responses to health topics, emphasizes concise and understandable answers, and directs urgent symptoms to emergency care.

## Product

- Welcomes first-time users, captures a preferred name, and requests explicit data consent.
- New chats proceed from consent to the health-support menu; existing sessions can retain a previously recorded pregnancy status.
- Provides a main menu for health questions, doctor booking, and reminders.
- Offers three mock Obstetrics/Paediatrics slots and a Paystack-ready payment handoff.
- Exposes a safe local preview route for stepping through the state machine before pairing WhatsApp.

## User preferences

- Keep this build strictly text-based on WhatsApp; native mobile apps, calls, insurance, custom AI training, and admin dashboards are out of scope.

## Gotchas

- The first run prints a QR code in the API workflow logs. Scan it with the WhatsApp number intended for Afeeyah AI.
- Do not commit `data/materna-auth` or `data/materna-sessions.json`; they contain pairing/session data and user chat history.
- Live AI and payment calls intentionally return a clear setup message when their secrets are absent.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
