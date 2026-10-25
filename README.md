# Nordic FICC corporate-event monitor

A browser-based Nordic Markets Advisory pilot with five views: opportunity radar, corporate events, risk advisory, alerts & catalysts and morning brief.

The active model is a composable corporate-event graph: independent lifecycle, workstreams, milestones, source claims, parties, bids, conditions, financing, cash flows, exposures, hedges, forecasts and commercial opportunities. Classification/state fields use fixed enumerations. Amounts use exact decimal strings; unknown is explicit.

The supplied ontology contains 40 event templates, 526 milestone IDs and 24 logical entities. See [model and production cutover](docs/corporate-event-model.md), [the original design](reference/corporate-event/Corporate_Event_State_Model.md) and [the executable field schema](lib/corporate-event-schema.json).

## Run in a browser

GitHub Codespaces installs dependencies through the existing devcontainer. Run `npm run dev`, then open forwarded port 3000. `node .devcontainer/start.mjs` starts once and waits for canonical API readiness. Node 24 is required. Local mode uses explicitly synthetic records in its own canonical SQLite store.

## Production

Use the existing Supabase/Vercel pilot. This version requires migrations 001–007; existing installations through 006 apply only 007. **007 is a breaking cutover:** it archives legacy data, retires old writes and removes old active fields. Back up and coordinate database migration with deployment using the [cutover guide](docs/corporate-event-model.md). No production migration is run by preparing this repository.

Existing authentication, invited membership, reviewer permissions, Cision source collection and push delivery gates remain. Collection and delivery default off. `LEARNING_ENABLED=true` enables the separate evaluated relevance-ranking workflow; field-level review audit is retained independently.

## APIs

- `GET /api/corporate-events`: canonical models and source timeline.
- `POST /api/corporate-events`: authenticated local/demo structured ingestion; pilot writes use reviewer source approval.
- `/api/reviews`: private drafts and atomic reviewer approvals/corrections.
- `GET /api/feedback/export`: reviewer-only, cursor-paginated field-level labels with source and programme/model context.
- `/api/pilot`, `/api/learning`, `/api/push`, `/api/jobs/run`: gated source, learning and delivery controls.
- `/api/deals` and `/api/events`: retired (HTTP 410).

## Verify

```sh
npm ci
npm test
npm run build
npm run test:api
npm run test:pilot
npx playwright install --with-deps chromium
CI=true CHROMIUM_PATH="$(node -e "process.stdout.write(require('playwright').chromium.executablePath())")" npm run test:e2e
```

Historical migration regressions remain under `tests/legacy-support`; the application does not import the old Deal model. Earlier rollout documents describe earlier releases; the corporate-event guide is authoritative for this version.
