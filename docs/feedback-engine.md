# Nordic FICC learning engine — first pilot version

This increment adds a financial hypothesis check and an actual case-based learning loop. It is not an LLM fine-tune, autonomous hedge adviser or a claim of demonstrated production accuracy. Existing Cision ingestion, factual source validation, human approval and notification conditions remain in place.

## What learns

New approvals and scored analyses supply reviewed FICC labels. A score of 3–5 means useful for opportunity prioritization; 1–2 means lower/no immediate FICC utility. Dismissals require a reason:

| Reason | Learning treatment |
| --- | --- |
| Not M&A, no Nordic connection, routine disclosure, low FICC relevance | Not-useful relevance label |
| Duplicate, stale/already covered, other/uncertain | Excluded from relevance learning |

A stale story does not teach the engine to reject a future fresh transaction. Low FICC relevance can change later: approve with score 1–2 if a deal should stay tracked rather than dismiss it. Dismissal does not create a watchlist deal.

The model compares fixed financial/process text signals (funding, financing, consideration, debt, currencies, process stages, own-share disclosures, etc.) with previous reviewed cases. It uses up to five comparable **distinct known deal/source groups**, preventing repeated updates about one deal from manufacturing support. It does not learn company-name blocklists or permanently remove news. After at least three comparable groups, the feedback changes a smoothed **priority index**, and can suggest a prior-case score estimate when enough reviewed scores exist. Neither is a calibrated probability or a verified FICC score.

**The initial effect is shadow suggestions:** they update as feedback accumulates, with comparable cases, reasons and similarity shown beside pending candidates. The newest-first queue stays unchanged. The model cannot determine a Nordic connection, fill a currency, edit a verified fact, approve a deal, change its reviewed score or authorize an alert. Ingestion's broad candidate screen is unchanged; learned ranking applies to the latest 100 pending items loaded by the review panel, not the entire feed or hidden backlog.

## Financial assessment

In an open review, click **Assess & save draft**. This deterministic evidence check is separate from the learned ranking. It requires exact, confirmed evidence values; it does not treat country, reporting currency, an assumed fund denomination, or a historical acquisition mention as proof of FX.

Use evidence labels such as:

| Evidence label | Example value, only when confirmed |
| --- | --- |
| Consideration type | `CASH`, `SHARES` or `MIXED` |
| Consideration currency | `SEK` |
| Buyer funding currency | `EUR` |
| Seller desired proceeds currency / Seller repatriation currency | `EUR` |
| Fund denomination | `EUR` |
| Debt currency | `NOK` |
| Debt rate type | `Floating` |
| Revenue indexation | `Inflation-linked` |

Each confirmed entry must have kind **Fact**. Supported currency codes are SEK, NOK, EUR, USD, GBP, DKK. A generic seller proceeds currency is not treated as the seller's desired conversion destination. Unknown/inferred values stay unknown. Conflicting Fact entries are flagged rather than resolved by guessing.

The output identifies conditional buyer/seller conversion angles, possible two-sided exposure, floating-rate and cross-currency questions, and missing inputs. Share consideration does not imply cash conversion; mixed consideration needs a cash-component amount. Fund denomination mismatch without actual funding remains a hypothesis. Terminal transactions require post-closing/unwind review. No trade or final score is generated.

## Deploy and enable feedback collection

1. Review branch **ficc-feedback-engine** and merge after checks pass. Keep `LEARNING_ENABLED` unset or `false` during deployment; existing review functionality remains available.
2. In Supabase SQL Editor, apply **only** [`202610240004_feedback_engine.sql`](../supabase/migrations/202610240004_feedback_engine.sql). Migrations 001–003 must already be installed. Do not re-run them. The migration adds append-only feedback, versioned models, settings, activation history, secure functions and a view of the latest label per source. It does not infer labels for old reviews or start any worker.
3. In Vercel Production environment variables, set `LEARNING_ENABLED=true` and redeploy. Keep `APP_MODE=pilot`, `PILOT_STAGE=2`, source and notification settings as they were. No new API key or training service is required.
4. Open **Alerts & catalysts**. The **Nordic FICC learning engine** panel should show **Shadow mode · queue order unchanged**. If migration 004 is missing, the panel reports it and feedback-enabled reviews fail rather than silently dropping labels.

Reviewer privileges are required to record/correct labels, save models or change ranking mode. Invited readers can view the shared workspace's explanations, decisions and model state. This is a **shared pilot model**, not personalized models or a multi-tenant training service. Feedback notes and source snapshots are visible to invited members of this workspace. The latest explicit label wins per source across reviewers; this version does not resolve disagreements by voting or consensus. Corrections are auditable and require an explanation. Original audit records are append-only through application permissions.

## Your validation — first loop

1. Dismiss an irrelevant pending candidate. Choose a reason and optionally explain why. Confirm it disappears and appears under **Latest 15 feedback decisions**.
2. Dismiss a duplicate or stale candidate. Confirm it is labelled excluded; it should not add a usable training case.
3. Approve a relevant source after reviewing facts, Nordic connection and score. An optional review note records why it is useful or what analysis you corrected. Approval and feedback are written in the same database transaction; a failed feedback write rolls back the review.
4. Review at least three comparable but distinct situations over time. Inspect their shadow priorities and comparable-case explanations. Unrelated items and cold-start cases must remain neutral. Suggestions may be wrong; retain your original judgment and record corrections.
5. From a recent feedback item, choose **Correct or exclude feedback** for labels, or **Edit saved assessment** to revise its full JSON after applying migration 005 (see [review fixes](review-fixes.md)). A note is required. This appends a correction and replaces only that source's latest training label; it does not change a tracked deal, reverse its approval or recall a notification. Exclusion keeps the audit trail but removes the case from future training.
6. Confirm the queue stays newest-first in shadow mode. Notification rules and FICC scores must not change because of a learned priority.

Earlier approvals/dismissals are not retrospectively labelled: an unexplained dismissal could have meant stale, duplicate or non-Nordic. Only new explicit feedback enters the dataset. Historical backfilling is a separate reviewed task. The working model uses the latest label for each of up to 500 reviewed sources; duplicate/stale/uncertain/excluded cases are omitted. Older audit rows stay in PostgreSQL. Only the latest 15 labels are shown in this first UI; full history remains in the database.

## Evaluation, promotion and rollback

**Evaluate & save version** stores a deterministic model snapshot. Evaluation holds out the newest known groups by feedback-review time, keeping all known updates about a deal/source out of its training split. The held-out label/score is never used as an input signal. The comparison baseline is source publication time (newest first). The stored artifact includes training/holdout feedback IDs and metrics so the split can be inspected.

Promotion is blocked until there are at least 12 distinct labelled groups, at least eight training cases and four held-out groups, sufficient positive/negative labels including both in the holdout, at least two held-out cases with comparable training support, and precision@3 no worse than the baseline. This is a **small pilot gate**, not statistical proof of improvement. Review label quality, class balance, missed opportunities and whether the holdout is representative before activating. Grouping handles known deal IDs and normalized story URLs, not all semantic duplicates or translated stories. This is not a test of unseen issuers or all news coverage.

Choose a saved eligible version and **Activate selected ranking** only after validation. Activation reorders loaded candidates by learned priority; it does not hide/delete them or change final scores/alerts. The final saved model uses all current labelled cases after its holdout evaluation. Active versions stay pinned; new feedback changes the working shadow model until you explicitly save and promote another version.

**Return to shadow** immediately restores newest-first queue order. Feedback corrections/exclusions also return an active ranking to shadow automatically. Old model artifacts remain for audit, but versions containing superseded/excluded labels cannot be reactivated; rebuild them using current labels. Model activation/deactivation is logged with reviewer identity. Disabling `LEARNING_ENABLED` and redeploying also removes learning influence, while preserving data.

## Optional AI draft memory

The existing **Draft with AI** feature still needs your configured `AI_API_KEY` and an explicit click. Shadow mode does not influence it. When a saved model is active, the request includes a bounded summary of comparable outcomes (reason categories, scores and similarity), with instructions that these are prioritization hints, not facts about the new transaction. It does **not** send feedback notes, reviewer IDs, prior counterparty names, prior full analyses or source snapshots as learning context. The new source excerpt is sent as before. The response identifies the learning version used. No LLM weights are retrained by this feature. Provider extraction accuracy still needs your evaluation.

## Remaining limitations

This is a transparent first learning engine over fixed signal categories. It does not yet provide semantic embeddings, issuer identity resolution, currency/ownership reference data, payoff/pricing models, trade execution, online weight optimization, personal models, full historical backtesting, outcomes-based commercial conversion tracking, or automatic source-filter deployment. Feedback selection is biased toward the reviewed queue; unreviewed and filtered-out news is not ground truth. Precision@3 is limited to the held-out labelled cases and does not establish recall across all Nordic M&A. Source evidence and human treasury confirmation remain essential.

For persistent draft saving, right-side editors, before/after JSON revisions and the exact learning impact of edited assessments, see [review-fixes.md](review-fixes.md). Apply migration 005 to use those fixes.
