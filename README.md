# Nordic FICC corporate-event monitor

A browser-based Nordic Markets Advisory pilot with five views: opportunity radar, corporate events, risk advisory, alerts & catalysts and morning brief.

The active model is a composable corporate-event graph: independent lifecycle, workstreams, milestones, source claims, parties, bids, conditions, financing, cash flows, exposures, hedges, forecasts and commercial opportunities. Classification/state fields use fixed enumerations. Amounts use exact decimal strings; unknown is explicit.

The supplied ontology contains 40 event templates, 526 milestone IDs and 24 logical entities. See [model and production cutover](docs/corporate-event-model.md), [the original design](reference/corporate-event/Corporate_Event_State_Model.md) and [the executable field schema](lib/corporate-event-schema.json).

## Run in a browser

GitHub Codespaces installs dependencies through the existing devcontainer. Run `npm run dev`, then open forwarded port 3000. `node .devcontainer/start.mjs` starts once and waits for canonical API readiness. Node 24 is required. Local mode uses explicitly synthetic records in its own canonical SQLite store.

## Production

Use the existing Supabase/Vercel pilot. This version requires migrations 001–010. Installations through 009 apply only the additive migration 010; earlier installations apply missing migrations in order. Follow the [manual-review rollout](docs/manual-review.md). Installations through 006 must first complete 007. **007 is a breaking cutover:** it archives legacy data, retires old writes and removes old active fields. Back up and coordinate database migration with deployment using the [cutover guide](docs/corporate-event-model.md). No production migration is run by preparing this repository.

Existing authentication, invited membership, reviewer permissions, Cision source collection and push delivery gates remain. Collection and delivery default off. `LEARNING_ENABLED=true` enables the separate evaluated relevance-ranking workflow; field-level review audit is retained independently.

## APIs

- `GET /api/corporate-events`: canonical models and source timeline.
- `POST /api/corporate-events`: authenticated local/demo structured ingestion; pilot writes use reviewer source approval.
- `/api/reviews`: private drafts and atomic reviewer approvals/corrections.
- `/api/extraction`: reviewer-triggered full-text extraction, retained evidence and saved-review evaluation.
- `/api/analyze`: retired excerpt-to-whole-graph extraction (HTTP 410).
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

Historical migration regressions remain under `tests/legacy-support`; the application does not import the old Deal model. Earlier rollout documents describe earlier releases; the corporate-event guide covers the model cutover and the manual-review guide defines the current review policy.

Manual-review upgrade: apply migration 008 after 007 and follow [task-based review rollout](docs/manual-review.md). This version uses compact task groups, optional evidence/nexus, core-only approval and product-aware currency selection.

Timestamp/mobile follow-up: installations through 008 apply only migration 009; see the [review guide](docs/manual-review.md#timestamp-and-mobile-follow-up-migration-009).

Full-article extraction pilot: follow the [configuration, review and benchmark guide](docs/evidence-extraction.md). Approval remains manual; background extraction stays off.
