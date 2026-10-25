# Corporate-event model: cutover, review and validation

This is a breaking replacement of the flat Deal model. The active API, storage, review editor, extraction prompt and five application views use CorporateEventModel. There is no legacy Deal write adapter. Old transaction stages, string currency pairs, free-text FX classification, advisory angles, rates descriptions and action labels are retired from the active model.

## Authoritative schema

The supplied reference files are kept unchanged in `reference/corporate-event/`. They are design data, not operational instructions. The original catalogue supplies 40 event templates, 526 milestone IDs, 10 lifecycle phases, nine parallel workstream vocabularies, dispositions, outcomes, assertion types and event relationship IDs.

`lib/corporate-event-schema.json` is the executable field/domain schema. It contains all 24 logical entities and seven junction types. Supporting fixed domains fill gaps in the reference's logical dictionary: roles, condition states, funding certainty, exposure classification, FICC product families, urgency, action codes, rationale codes, rates profiles, units, and similar categorical fields. These additions are application choices, not a claim that the reference JSON prescribed every enum. Null explicitly means unknown/not recorded. NOT_STARTED and NOT_REQUIRED require an explicit selection.

Classification dimensions are independent: purpose, execution route, ownership/control outcome, financing, separation method and programme type. A PUBLIC_OFFER may coexist with an LBO financing event and bond refinancing. Relationships connect them; they do not duplicate purchase consideration.

The records retain the reference field names. IDs are stable inside a model namespace; the globally addressable identity is `(model_id, record_id)`. A programme and its related/alternative events should share a model bundle so evaluation can group them. Record IDs are never company names or inferred entity matches.

All state/classification inputs use fixed choices. Factual names, source quotations, contractual provisions, identifiers and review explanations remain factual inputs. Dates and exact financial amounts are validated values rather than enum labels. Money is a decimal **string**, never a JavaScript floating-point number. Probability, evidence confidence and commercial score use distinct fields and semantics.

## Storage and security

Migration 007 installs the versioned catalogue, a canonical model table, a schema-validated record index, 31 typed query views, immutable model/source review versions, field-level feedback and source announcements. These are a graph plus a typed query index, not 31 independently writable business tables. Amounts project as PostgreSQL numeric; uncertain dates remain precision-aware strings. Both application and database validation enforce domains and typed local references. No display-order dependency is generated from the milestone catalogue.

Invited members can read canonical data. Only reviewers can save source reviews through the authenticated, origin-checked Stage 2 application route and reviewer-checked RPC. Direct member writes to canonical tables are revoked. Private drafts remain private. Historical model versions and reviewed source snapshots are append-only to clients. There is no service key in the browser.

`access_scope` is metadata within the existing single invited pilot workspace; it does not implement a separate per-document wall-crossing entitlement system. Country rulebooks and transaction-specific legal dependencies must be configured by the user; the catalogue is not a universal legal workflow engine.

## What is archived and removed

Migration 007 archives original deal/source rows before conversion. The old tables become `legacy_deals`, `legacy_deal_events`, `legacy_review_drafts` and `legacy_review_revisions`; old draft owner policies remain in place. Raw legacy snapshots are admin-only. The active `source_items.deal_id` and `assessment` columns are removed, and the old write RPCs are revoked. `/api/deals` and `/api/events` return HTTP 410. The old model/store implementation survives only as historical migration test fixtures, outside the application dependency graph.

Migration imports source evidence and named parties without inventing economic legs, funding draws, exposures or lifecycle phases. Legacy confidence/score/stage strings are not converted into new factual states or completion probabilities. Imported claims are marked LEGACY_IMPORTED; analysts must reclassify and verify them. Previously saved free-text drafts remain in the private legacy archive, not silently interpreted as new-model drafts.

## Production cutover

1. Review the branch, migration and a fresh green CI run. Test against a copy of the pilot database where possible.
2. Take/verify a Supabase backup or database export. Migrations 001–006 must already be installed.
3. Schedule a short pilot maintenance window. Apply **only** `202610250007_corporate_events.sql` in the existing project's SQL Editor, then deploy this branch immediately. The old application is incompatible once old writes/tables are retired. Do not rerun earlier migrations.
4. Reload the app, verify `/api/readiness` reports ontologyVersion 1.0.0, and use the checklist below.
5. Rebuild and evaluate a v3 relevance model before activating learned queue ordering. Old M&A-only rejection labels are excluded until re-reviewed under the broader corporate-event scope. Old learning artifacts remain for audit; migration returns ranking to shadow mode. Collection and notification flags are not enabled by this migration.

For a fresh installation, apply migrations 001–007 in order before launching this version. Stage flags control product access, not whether the canonical schema must exist.

The migration is transactional: a SQL error rolls back the cutover. Reverting application code after a successful cutover is not a database rollback. Preserve new writes and plan a forward repair or restore from a verified backup; no destructive automatic down-migration is provided.

## Validate a review

- Open Alerts & catalysts, then Review beside a source item. The right-hand drawer keeps its action footer outside the scrolling body, including on mobile.
- In CorporateEvent, select a fixed event type and lifecycle; leave unobservable states unknown. Select other classification dimensions independently.
- In Entity, record the actual named entity. In Claim, add/verify a NORDIC_NEXUS proposition, its source, assertion type and ACCEPTED review state. In EventJurisdiction, select the Nordic country (SE/NO/FI/DK/IS), nexus entity and that claim. Geographic nexus is not a currency inference.
- Add a WorkstreamInstance and choose its type. Its status dropdown must contain only that workstream's states. COMMITTED financing must not complete the acquisition or create a cash leg.
- Add milestones using the fixed catalogue IDs. An asserted status needs supporting claims, which may explicitly be analyst inferences. A recorded completion needs an accepted factual EVENT_COMPLETION claim with a true value, plus satisfied/waived configured conditions. Waivers require permission.
- Add FundingInstrument, EconomicLeg and RiskExposure records separately. Record actual payer, payee, currency, amount/range, dates, restrictions and source references. Separate commercial Opportunity fields from actual Hedge contracts.
- Save a draft, close and reopen; confirm it restores. Verify the pre-review references alongside fields. A supported comparable-case score is a suggested commercial hypothesis, never a verified exposure.
- Select the update classification (UNKNOWN, MATERIAL_UPDATE or NO_MATERIAL_CHANGE), then confirm and approve. Unknown update classification never queues an alert; an unscored FICC case is excluded from usefulness training rather than treated as negative. Reopen a saved assessment, correct one enum and add a reason. Verify the revision and correction persist. A correction to an earlier source must preserve a later current event model and must not send another alert.
- Dismiss routine results using Reporting; use Not a qualifying corporate event for unrelated items. Dismissals and label-only corrections remain distinct from graph-field edits.
- Check all five views, watchlist, model export, source run history, delivery history and your existing subscription controls.

## Economics and learning limits

Gross cash-flow summaries group explicit economic legs by parties, currency and flow type. They omit funding instrument commitments, parent legs with child decomposition, internal/unknown-group legs, incomplete parties/amounts and unselected mutually exclusive scenarios. They do not convert currencies, calculate net exposure or multiply notional by completion probability. Unknown offsets/restricted cash are not assumed available. This is not a treasury netting or valuation engine.

The relevance model remains an evaluated, case-based source-text classifier. It now recognises additional corporate-event signals and groups known programme/model histories together for held-out evaluation. Canonical changes create structured `(entity_type, record_id, field, proposed_value, corrected_value)` labels with reviewer, ontology version and observation history. Removals are retained as corrections, not erased.

Reviewers can page through `/api/feedback/export?after=0` for the latest non-superseded training labels with frozen source snapshots and programme/model groups. These data enable separate future evaluation of retrieval, entity resolution, type/lifecycle classification, financial extraction and exposure inference. They do not automatically fine-tune an LLM or calibrate completion forecasts. Keep programmes and time periods separated during training/evaluation; never reuse confidence as a completion label.

## Repository verification

Run `npm test`, `npm run build`, `npm run test:api`, `npm run test:pilot` and `CI=true npm run test:e2e`. The browser suite covers canonical filtering/views, draft restoration, enumerated review/correction, mobile footer hit-testing, workstream-specific domains, reporting feedback and reviewer/reader differences. Database tests exercise migration, access control, source/model version conflicts, audit persistence and historical corrections.

The committed migration is generated from the checked-in schema/catalogue using `bash scripts/build-event-migration.sh`. Regeneration must be followed by the database tests and review of the SQL diff. No generation step runs against production automatically.
