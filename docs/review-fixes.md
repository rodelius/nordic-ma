# Review persistence, correction and learning fixes

## What was wrong

- **Assess FICC hypotheses** computed a React-state preview only. Clicking it did not save that preview or your in-progress JSON. Only a successful final approval persisted the analysis JSON.
- A native required checkbox could stop submission before a visible application message. Server validation errors appeared above the entire source list, potentially far from the editor. A save could therefore appear to do nothing.
- The latest-15 editor corrected only learning labels/scores, not the underlying JSON assessment. It opened below the list, used default labels rather than the current values, and could display errors out of view.

## Deploy

1. Review branch **fix-review-persistence**.
2. Before deploying/merging its new UI, apply **only** [`202610240005_review_persistence.sql`](../supabase/migrations/202610240005_review_persistence.sql) in Supabase SQL Editor. Migrations 001–004 must already be installed. This additive migration is compatible with the current application while the new deployment completes. Do not re-run earlier migrations. No tables or existing reviews are deleted.
3. Merge and wait for Vercel's production deployment. No new environment variables or credentials are needed; retain `APP_MODE=pilot`, `PILOT_STAGE=2` and the existing `LEARNING_ENABLED` setting.

## New review flow

**Review**, **Dismiss**, **Edit saved assessment**, and **Correct or exclude feedback** open a right-side pane, with an internal scrollbar. The page stays in place. Mobile uses a full-width pane. Close/Escape returns to the selected item. While saving, closing is disabled to prevent a successful request from closing a different editor opened in the meantime.

- **Save draft** persists your JSON text and review note privately for your reviewer account, including incomplete JSON. It does not approve a transaction, teach a label, or send an alert.
- **Assess & save draft** also calculates and stores an evidence-based assessment when the JSON/evidence is sufficient. If it is not, the text is still saved and the pane explains that no assessment could be calculated.
- Close and reopen **Review** to restore the saved draft, note and assessment. Typing after a save is marked **Unsaved changes**; you must save again to persist those edits. There is no keystroke autosave.
- **Approve reviewed update** validates the final JSON, Nordic connection and confirmation checkbox. Missing information and server errors appear inside the pane immediately. The source URL and publication time are taken from the actual announcement, not editable JSON metadata.
- Approval writes the final JSON, financial assessment, revision history and (when learning is enabled) learning feedback in one transaction. Failed feedback writes roll back the approval rather than leaving a partial result.

Drafts are private to the reviewer who saved them. Two tabs cannot silently overwrite the same draft: a stale draft or review version is rejected. An older saved draft is retained for manual recovery if another reviewer has updated the approved analysis.

## Past-15 corrections

Approved cases can be reopened from **Saved assessments (latest 15)** even when learning is disabled, or from **Latest 15 feedback decisions** when a learning record exists. There are now two separate actions for an approved case:

- **Edit saved assessment** opens its existing JSON and assessment. Save a correction with an explanatory note. This appends a before/after revision and updates the learning label/score. It also updates the tracked transaction **only if this source still supplies its current assessment**. If newer news has updated the transaction, only the older source's history is corrected; the newer transaction state is preserved. Corrections do not generate market events or new push notifications. Unsent deliveries for the corrected source are cancelled, and workers recheck their delivery lease before dispatch. A notification already accepted by a push service cannot be recalled.
- **Correct or exclude feedback** changes only the learning label/score. It now preloads current values and shows errors beside the controls. Changing a score aligns its usefulness label; excluding feedback clears the training score. It does not edit transaction JSON or recall prior notifications.

Previously approved JSON remains in `source_items.analysis`. If it predates this fix, the editor can reconstruct the deterministic assessment from that JSON until you explicitly save a new revision. A preview that was never approved or saved in the old version existed only in browser memory and cannot be recovered after it was lost.

## How edited JSON affects future learning

**Before this fix:** final JSON was stored against the item/transaction, and its score/relevance label affected case-based ranking. Detailed JSON edits were not preserved as structured learning corrections. The label-only history editor did not fix the item JSON.

**After this fix:** every full assessment save retains its JSON and deterministic assessment; corrections retain both previous and corrected JSON, changed-field names, reviewer identity and revision. New feedback rows capture the reviewed JSON snapshot. The latest label/score remains the ranker's training target. Detailed financial corrections are stored for audit and future supervised extraction work. Saved case models can also carry financial field-correction cues (`score`, `pair`, buyer/seller FX flags, classification, angle, rates and evidence); an activated model includes these bounded cues in an explicitly requested AI draft, helping identify fields that need particular scrutiny.

This does **not** mean every JSON value automatically updates model weights or that one deal's EUR/SEK exposure becomes a fact for another deal. The current ranker learns usefulness and score from comparable source text. Other corrected details are reusable, auditable examples and limited review-memory cues; no LLM fine-tuning occurs. First-review edits are saved as the reviewed target JSON, but this version does not retain an original AI draft versus final JSON pair unless those were separately saved/revised. Model evaluation and explicit promotion still apply; corrections return active ranking to shadow mode. Existing frozen models need to be rebuilt/promoted to incorporate new correction cues.

## Validate

1. Open a pending item halfway down the list. The pane should open without scrolling to the end.
2. Click approval with confirmation unchecked: an explanatory message must appear immediately in the pane.
3. Save a draft, close it and reopen it. Confirm the exact JSON, note and assessment are restored. Invalid/incomplete JSON should save as text but cannot be finally approved.
4. Complete and approve a source. Confirm a saved assessment is accessible from **Latest 15 feedback decisions → Edit saved assessment**.
5. Change its JSON score/evidence and save a correction with a note. Reopen it and verify the corrected values and revision history. Check that feedback reflects the new score. No new alert should have been queued by the correction.
6. Try **Correct or exclude feedback** separately. Confirm current values are preselected and invalid/incomplete input produces an in-pane message.
7. A correction of an older announcement must not replace a newer source update on the transaction.

Local tests cover the database transactions, private draft access, version conflicts, before/after snapshots, full assessment feedback, rollback on feedback failure, and protection of newer news. Browser tests cover pane positioning, visible validation errors, draft reopening, saved JSON corrections and existing workflows. Your production migration and browser/session behavior still need the validation above.
