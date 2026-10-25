# Task-based manual review

This release builds on the corporate-event model installed by migration 007. It replaces the technical record selector with **RecordGroup** and eight user-task groups: CorporateEvent, RiskManagement, Parties, BidsAndNegotiations, ProcessAndApprovals, Financing, EvidenceAndReview and OutlookAndActions.

## Rollout

1. Review this branch and a green CI run.
2. Apply **only `202610250008_manual_review.sql`**, after 007, in the existing Supabase project. It preserves all existing data, source versions, correction history and record IDs. Do not rerun 007.
3. Merge/deploy this version and reload the app. The review endpoint reports a clear migration-008 message if the policy update is missing.
4. Validate a core-only approval, an old saved-assessment correction, an exposure without a hedge, and a deliberately added FX/rates hedge.

No new credentials or environment settings are required. `SCORING_FEEDBACK_LIMIT` is optional (1–500, default 500). The relevance model uses that many latest source labels. Review history covers at least 100 decisions, or the configured/active scoring window if larger, up to the existing 500-case limit. The UI initially renders 100 and offers **Show next 100**. Saved assessments have the same larger review window.

## Compact editing

The CorporateEvent view always offers title, event type, lifecycle, disposition, the radar FICC score, party names/roles and Nordic countries. When multiple opportunities have scores, the score control represents the highest opportunity, matching radar aggregation; individual scores remain editable in OutlookAndActions.

Other records appear only when they contain substantive values or have just been explicitly added. Technical IDs and the current event link do not make an empty record substantive. Populated optional fields appear first. **Edit remaining fields** opens the rest without making them compulsory. Expandable sections have counts and readable summaries; repeatable records have separate cards. Expanding a section never creates a record.

Only event type, lifecycle and disposition are compulsory CorporateEvent classifications on approval. Other data may be unknown or unpopulated. Internal IDs are generated automatically. Populated values must still have valid enum IDs, typed references, exact decimals and consistent currencies. Drafts can be saved before the core classifications are finished.

Nordic nexus, a separate nexus entity and a verified nexus claim are no longer approval dependencies. Completion/evidence completeness appears as a non-blocking review warning; recording a classification does not establish legal readiness or execute a financial transaction. Explicit contradictions such as an impermissible waiver, negative allocation or invalid currency pair remain invalid.

## Inline relationships

Programme, related events, party roles, scope/perimeter, event classifications and sources appear beneath CorporateEvent. Event-prefixed records are absent from RecordGroup. Party role choices create the EventParty relationships; source additions create EventSource links; classifications and perimeters maintain their technical associations.

EvidenceAndReview offers source/claim/review cards. **Applies to** manages ClaimSupport. RiskManagement offers cash flows, exposures and hedges, plus **Match exposures** for the allocation links. Matching does not create a hedge. Removing a match removes both the allocation and the corresponding exposure/hedge relationship.

A new record inherits the current event where the model has an event field. Records such as a hedge remain scoped to the current model and are associated with exposures through explicit matching. Optional references may remain unknown. Only populated references are validated against their actual target type.

## Currency and hedge behavior

Every currency selector starts with **DKK, EUR, GBP, ISK, NOK, SEK, USD**, followed by the remaining ISO codes alphabetically. The requested `ILK` is represented by **ISK**, the ISO code for Icelandic króna.

FX forwards/options/contingent FX and cross-currency swaps use a distinct base/quote pair. IRS, rate caps/collars, inflation swaps and commodity pricing use a single currency. A partial known FX pair must be completed before final approval; an entirely unknown pair can remain unpopulated. Product selection never creates a Hedge implicitly.

Exposures are saved independently of hedges and products. The initial hedge controls are an explicitly labelled proposal; **Add Hedge** is the action that persists a Hedge record. A hedge record describes a record/proposal/contract; adding it does not execute a trade. Existing hedge details and matching amounts remain optional until supplied. Known notional/allocation units must agree; unknown units stay incomplete and are excluded from matching calculations.

## Nordic context and source defaults

Nordic countries use a multi-select (DK, FI, IS, NO, SE). Legacy `OTHER` claims containing a Nordic-connection label are shown as readable text. The editor can suggest countries from that text; clicking the suggestion or choosing countries updates the country links and normalizes the legacy claim to NORDIC_NEXUS without changing its LEGACY_IMPORTED evidence-review status. It does not certify a new fact. Nexus countries are not copied into legal jurisdictions.

Current feed source documents use the feed publication date, feed name in issuer, first collection time for retrieval, and PUBLIC as the default access scope. Existing non-public scopes or a manually populated issuer are retained. The current source URL/publication time stay bound to the incoming feed record. Pre-review references and correction history retain earlier values.

Where the vocabulary defines UNKNOWN, NOT_APPLICABLE or NOT_REQUIRED, the UI labels these explicitly. Missing fields are labelled Not yet populated; explicit null values are labelled Unknown when opened. Zero and false are populated values and remain visible. Empty technical containers do not imply that an activity did not occur.

## Verification

Database tests apply migrations 001–008 and prove approval with just the core classifications and source identity, without nexus, exposure party or hedge product requirements. They cover FX pairs versus rates currencies, version conflicts and optional records. Browser tests cover compact fields, task groups, draft restoration, old decisions beyond the first 100, mobile footer hit-testing, legacy Nordic context, metadata defaults, matching/unmatching and explicit hedge creation.

Earlier guides describe the prior release's stricter evidence and nexus gates. This guide defines the manual-review policy after migration 008; existing enum IDs and ontology version 1.0.0 remain unchanged.

## Timestamp and mobile follow-up (migration 009)

Installations already through 008 apply only `202610250009_timestamp_precision.sql`, then deploy the timestamp/mobile branch. This additive migration accepts PostgreSQL timestamps with up to six fractional digits, including `2026-10-25T07:09:35.061449+00:00`. Neither the app nor the database truncates source retrieval precision. Earlier migrations must not be rerun. Existing drafts and saved reviews need no conversion. Reopen the affected review and approve it after deployment.

Navigation now uses Event radar, Corporate events, Exposures & hedges, News & reviews and Morning brief. Review section is the visible label for RecordGroup. Source fields use plain labels, while original values are expandable beside each input. Mobile event tables become labelled cards. Larger text, 44px minimum primary controls, visible focus rings and labelled/bordered status surfaces improve readability without relying on red/green distinctions.

Validate an affected six-digit retrieval timestamp, a saved-assessment correction, menu navigation on a narrow screen and approval after scrolling. Do not manually change the retrieval time to work around the old error.

## Recommended next delivery: evidence-backed automatic extraction

The next priority is extracting substantially more from Cision articles into this graph. Start with a fixed, manually reviewed evaluation set covering acquisitions, disposals, bids, financing, completion updates and irrelevant reporting. Keep issuer names, timestamps and source text snapshots alongside each case.

1. Retrieve and retain permitted full article text, rather than relying on truncated feed excerpts; record retrieval failures and source revisions explicitly.
2. Extract parties/roles, event type and independent process states, dates, conditions, financing, consideration and explicit currencies into enum-constrained draft records. Every factual suggestion should link to an exact supporting source passage. Missing facts remain unknown.
3. Resolve repeat announcements to the same corporate event; distinguish new events, material updates and repeated reporting before proposing changes.
4. Present suggested changes beside the current approved values for review. Treat FICC exposure and product recommendations as separate hypotheses; never infer a funding currency or create hedges solely from domicile.
5. Measure field precision, coverage, enum errors and reviewer correction/time by event type on held-out cases. Use corrections to improve prompts and comparable-case suggestions; field audit retention alone is not automatic model training. Enable background extraction only after these checks, keeping approval and delivery gates.

This release fixes validation and the review interface; it does not activate unattended extraction or notifications. The subsequent [Python extraction pilot](evidence-extraction.md) supersedes the earlier AI-provider proposal and uses deterministic rules without AI tokens.
