# Guided review rollout and validation

This release preserves the five views, existing assessments, draft text, revision history and source items. It replaces JSON-only review with a guided form; Advanced JSON is still available. Production has not been modified by preparing this branch.

## Rollout

1. Review the `guided-review` branch and its checks.
2. In the existing Supabase project's SQL Editor, run **only** `supabase/migrations/202610240006_guided_review.sql`. Migrations 001–005 must already be installed. Do not rerun those migrations. Migration 006 is transactional and compatible with the previous app's RPC calls.
3. Merge the branch and let Vercel deploy it. No new environment variables or credentials are needed.
4. Refresh the live app. Go to Alerts & catalysts and open Review beside an item.
5. Use the validation checklist below before enabling any additional delivery or collection.

Migration 006 retains all stored models but returns learned ranking to shadow mode because feature extraction now recognises reporting. Build and evaluate a fresh v2 model in the learning panel; activate it only when its holdout gate passes and you have inspected the results. Notifications and collection settings are not enabled by this migration.

## Validate the review workflow

- See the source excerpt, guided free-text fields and category dropdowns. An existing category outside the suggested dropdown list stays available.
- Confirm that a pre-review value is shown beside each field. Uncertain or edited fields can be isolated with **Focus on changed / unknown fields**; **Show all fields** restores the complete form.
- With sufficient comparable feedback, a pending item receives a suggested score by default. Its original score remains visible. There must be at least three scored comparable groups; otherwise no learned score is inserted. An already approved assessment or saved draft is never automatically overwritten by a new suggestion.
- Leave Target (and other unknown descriptive values) empty. Save draft, close and reopen. The values must stay empty. On approval they remain empty; the dashboard displays the source headline as a fallback without changing the stored target.
- Set a valid Nordic country and provide factual Nordic connection evidence. Approval still requires score 1–5, FX classifications, confidence, stage, material update and valid source metadata. Missing facts such as target, amount or timing are not invented or required merely to fill a field. Incomplete drafts may always be saved.
- Use the evidence controls for consideration type/currency, buyer funding currency, seller desired proceeds currency, debt currency and rate basis. Choose Fact only when the current announcement supports it. Reporting currency or company location alone does not establish a funding mismatch. A value entered as Inference does not become a Fact when saved.
- Confirm the review and approve it. Check **Open next item after approval** to continue through the pending queue. To accept unchanged, leave the fields unchanged, confirm the source check, and approve.
- Reopen the assessment from Saved assessments, make a full correction and supply a note. Reopen again to verify persistence and revision history.
- Dismiss a routine results release using **Reporting**. Confirm the feedback history records a not-useful label. Material transaction or financing news within a report may still merit review; this reason is an analyst decision, not an automatic reporting filter.
- Matching headlines are grouped conservatively in the pending queue. **Show matching headlines** exposes every source. No source is deleted, automatically dismissed or automatically linked to a transaction. Materially changed headlines remain separate. This is not semantic cross-language deal clustering.

## What improves learning

The final assessment and score remain the labelled outcome. A new private draft/reference field and append-only revision field additionally retain the original pre-review input, the displayed suggestion, its version/explanation, and final submitted JSON. Full source corrections already retain before/after assessment history. Reference snapshots represent the reviewer's editor state, not independently attested source facts.

The case-based model learns usefulness and FICC score from reviewed source text, including the new reporting signal. Duplicate, stale and uncertain dismissals remain excluded. The suggestions shown in shadow mode are explicitly labelled and do not silently activate learned queue ordering. An item's own review and known transaction group are excluded from its comparable-case score suggestion.

Financial correction-field cues can inform AI drafts when an evaluated model is active. Names, amounts, currencies and dates are not copied from older transactions into new ones. The evidence fields distinguish M&A relevance from an actionable FICC hypothesis and retain facts separately from inferences. They are available for future evaluation/training; this release does not automatically fine-tune an LLM or claim that every field is a separately trained predictor.

## CI changes and limits

The public GitHub job page identifies the failing step as desktop/mobile browser verification; unit/database, build, API checks and Chromium installation passed. The detailed job log was unavailable to this session (GitHub API access was denied), so the precise historical browser assertion cannot be confirmed.

CI now uses the already-validated production build with Playwright managing server readiness and shutdown, rather than a detached development server. It runs browser tests with one worker and retains failure screenshots, traces, HTML reports and streamed server/test logs as the `browser-failure-evidence` artifact. Checkout/setup-node use Node-24-compatible v5 actions, and the runner is pinned to Ubuntu 24.04 to avoid the announced ubuntu-latest transition. A successful fresh GitHub run remains the final hosted-runner validation.

Local verification passed with the installed Chromium 154: 22 unit/database tests, production build, both HTTP integration suites and 18 desktop/mobile browser tests in CI mode. Downloading the Playwright-pinned Chromium 156 was blocked by this cloud environment's network policy; GitHub installed its pinned browser successfully in the earlier run. This browser-version difference is another reason to require a fresh green hosted run.
