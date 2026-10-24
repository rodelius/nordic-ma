# Nordic / FICC Intelligence

A responsive Next.js / React / TypeScript prototype implementing the supplied Nordic M&A / FICC brief. This project is separate from the legacy `/workspace/cards` checkout. The original brief is in [docs/product-brief.md](docs/product-brief.md).

## Open in a browser (GitHub Codespaces)

The project includes automatic Node 24 setup, dependency installation, development-server startup and forwarding of port 3000. Open [this project in GitHub Codespaces](https://codespaces.new/rodelius/nordic-ma?quickstart=1), or follow [the browser-only Codespaces guide](docs/codespaces.md). No development tools need to be installed on your Mac. Once the Codespace is configured, use **Ports → 3000 → Open in Browser**. The one-command restart is `node .devcontainer/start.mjs`.

## Run

Requires Node 24 (uses `node:sqlite`) and npm. No database service or credentials are required for the synthetic demo.

```sh
cd /workspace/nordic-ficc
npm ci
npm run dev
```

For production-mode local verification: `npm run build && npm start`. The dashboard runs on port 3000. SQLite state is in ignored `data/monitor.sqlite`. Data survives process restarts; live processes do not survive environment publication. Do not delete `data/` to refresh synthetic timestamps: it also contains analyst-entered records and subscriptions.

## What works

- Five responsive views: Opportunity Radar, Deal Intelligence, Risk Advisory, Alerts & Catalysts, Morning Brief.
- Country, search, FICC score and 6h–7d window filters; browser-persisted watchlist; deal detail drawer; advisory memo and JSON brief exports.
- Six fictional scenarios, visibly distinguished from analyst-supplied data. No seed record is a claim about a real transaction. Seed timestamps are created on first database initialization and remain fixed afterwards.
- A–F morning brief sections and the requested compact daily action table. Rolling-window deltas use source timestamps; this is not a comparison of two separately archived daily publications.
- SQLite transactions, persistent event journal, content-based deduplication, stale/no-change suppression, closed/failed protection. Same-event replays are idempotent. New deal imports use a stable key; use events for subsequent updates. Entity resolution across differently named stories remains an analyst task.
- Authenticated new-deal and source-event ingestion. Analyst input is not independent source verification.
- Optional AI extraction from pasted public source text, returned as a reviewable draft. Only explicit reviewer save creates a deal. The API validates shape, enums, timestamps, Nordic connection and source metadata; it cannot verify that an AI or human claim is true.
- Optional Web Push with persisted subscriptions, expired-subscription cleanup, and push click-through to the relevant deal.
- PWA manifest, icons and service worker. Requires connectivity; there is no offline market-data cache.

## Configure securely

Copy `.env.example` to `.env.local` and enter values locally or through your deployment's secret settings. Do not place secrets in browser bundles, chat, Git or source events.

`INGEST_TOKEN` protects write and AI endpoints. Supply `Authorization: Bearer <token>` to them. The analyst input form keeps its token in memory only. AI extraction additionally needs `AI_API_KEY` with access to the configured `AI_MODEL` (default `gpt-4.1-mini`). It calls `https://api.openai.com/v1/chat/completions`; no provider connection or extraction accuracy has been verified in this environment because no key was supplied. Pasted text is sent to that provider only when the user chooses Extract draft.

For push, generate a VAPID keypair with `npx web-push generate-vapid-keys`, store `VAPID_PRIVATE_KEY` securely, and set `VAPID_PUBLIC_KEY` and a real `VAPID_SUBJECT` (`mailto:` or HTTPS contact). Restart the server after changing environment values. Use HTTPS in deployment. On iOS 16.4+, add the PWA to the Home Screen, open it there, then enable alerts. Push delivery has not been tested end to end without VAPID configuration and a device subscription.

On material updates to deals scored 3+, the server attempts delivery to subscribed browsers, including closed/failed events. Synthetic alerts are prefixed DEMO. There is no retry queue, per-user delivery isolation, or notification preferences yet. Failed push attempts do not roll back the ingested event and are reported in the API result; replaying a duplicate does not resend. Add a durable outbox before relying on delivery guarantees.

## Ingestion API

`GET /api/deals` returns transactions, event history and last event-ingestion time. `GET /api/brief?hours=24` returns the A–F brief and complete rows. Invalid windows return 400.

`POST /api/deals` accepts a full structured `Deal` (see `lib/model.ts` / manual structured input in Analyze source). Server assigns id, New status and non-synthetic provenance. Every required field, evidence item and source is validated. Non-Nordic targets are supported when another participant or material asset supplies the Nordic connection: `country` identifies that connection; explain it in evidence. New transactions scored 3+ also trigger a push attempt after explicit analyst save.

`POST /api/events` accepts:

```json
{
  "dealId": "alpha",
  "headline": "Illustrative process update",
  "delta": "Final bidder granted exclusivity; settlement currency remains unconfirmed",
  "stage": "Exclusivity",
  "timestamp": "2026-10-24T10:00:00Z",
  "sourceUrl": "https://example.com/illustrative-release",
  "type": "Process"
}
```

Use actual publication timestamps. Allowed event types: Process, Financing, Regulatory, Closed, Failed. This example references a synthetic deal and remains synthetic after updates. Older sources are retained without replacing current state. Terminal deals cannot be reopened through this endpoint; manual analyst review is required. Materiality is a deterministic change rule, not a validated semantic AI judgment. Scores and hypotheses are analyst-owned and are not automatically revised by incoming milestones.

`POST /api/analyze` accepts `{text,url,timestamp}` with 100–50,000 characters of source text. It returns `{draft,warning}` without saving or notifying. In the UI, review and edit the resulting JSON, confirm evidence and assumptions, then explicitly save. Missing credentials return 503 without making a provider request.

## Scheduled monitoring

No live sources, search service or scheduler are configured. `scripts/ingest.mjs` is a connector for an authorized **structured JSON event feed**, not a news scraper. Set `EVENT_FEED_URL`, `APP_URL`, `INGEST_TOKEN` in the scheduler environment and run:

```sh
node scripts/ingest.mjs
```

It validates events through the API and suppresses duplicates. A real deployment must connect issuer IR releases, Nasdaq Nordic announcements and regulatory sources under their applicable access arrangements. A source worker must extract candidates, match entities, validate evidence and obtain analyst approval before forwarding structured events. Use the product brief's search terms and participant lists for coverage; broad automated news search has not been implemented. Do not present the synthetic demo as a live monitor. No requests to employer systems or licensed content were made.

## Verification

```sh
npm test
npm run build
# Isolated production API checks (starts a temporary server on port 3101):
npm run test:api
# With the server running and system Chromium installed:
npx playwright test
```

Unit tests exercise ranking, time windows, payload rejection, brief classification, deduplication, stale-event retention and terminal-deal suppression. Playwright checks desktop/mobile navigation, country filtering, evidence drilldown, watchlist, brief table, horizontal overflow, API authentication and manifest delivery. Set `CHROMIUM_PATH` if Chromium is located elsewhere. Browser screenshots are in `docs/desktop.png` and `docs/mobile.png`.

## Deployment boundary

This prototype uses **SQLite on persistent disk**, not Supabase. Run it on a single Node server with a persistent volume for evaluation. Do not deploy unchanged to ephemeral Vercel functions: migrate storage to PostgreSQL/Supabase and use a managed job runner first. Add user authentication/authorization, tenant-isolated subscriptions, audit permissions, rate limits, provider cost limits, durable notification retries, source connectors and historical precision/recall validation before live use. Read endpoints are currently public; protect the whole deployment before entering non-public data. Fonts have system fallbacks if Google Fonts cannot load. Source repository: [rodelius/nordic-ma](https://github.com/rodelius/nordic-ma). A Codespace, v0 project and Vercel deployment have not been provisioned by this task.
