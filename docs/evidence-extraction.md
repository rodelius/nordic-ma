# Full-article extraction: manual pilot

This release adds reviewer-triggered extraction into the canonical corporate-event model. It does not start background extraction, approve events, change queue-ranking models, or alter existing source collection/notification settings. The former excerpt-to-whole-graph `/api/analyze` endpoint is retired (410).

## Release and configuration

1. Review the branch and its verification run.
2. In Supabase SQL Editor, apply **only `202610250010_evidence_extraction.sql`** if the project is already through 009. Earlier installations must finish the prior migrations in order. Do not rerun 007–009. Migration 010 adds separate extraction/evaluation tables and preserves reviews and event graphs.
3. In Vercel, set server-only `AI_API_KEY` to an OpenAI API key and `AI_MODEL` to `gpt-4.1-mini` (the default) or a compatible model supporting Chat Completions JSON mode and the configured token/temperature parameters. Never use NEXT_PUBLIC or paste credentials into chat. The existing `SUPABASE_SECRET_KEY` is required to retain server-generated extraction artifacts; it remains server-only.
4. Merge/deploy and sign in as an invited reviewer with `PILOT_STAGE=2`.
5. Validate one pending-source extraction and one saved-case comparison below. No new scheduler or automatic-extraction flag is introduced.

Production Vercel needs outbound HTTPS to `news.cision.com`, `api.openai.com` and the existing Supabase project. For Codex network validation, add `api.openai.com` through the environment's supported network settings if you want to test the provider there. This repository's tests mock provider responses and do not need an API key. No live provider or private production review benchmark was run while preparing this release.

## Review a pending source

1. Open **News & reviews → Review → Full article & suggestions**.
2. Click **Extract full article**. This fetches the article and makes one provider request. The feed excerpt is never substituted when retrieval fails.
3. Expand **Read retrieved article**. Check the text, retrieval time and content hash. Each field suggestion shows a verbatim quotation and character offsets in this normalized text.
4. Select fields, including referenced party records where needed. **Apply selected suggestions to draft** is an explicit action. It can overwrite selected current draft values; unselected fields remain unchanged. If record identity is ambiguous, a new record is added rather than silently merging multiple instruments/parties.
5. Inspect the task-group editor, save a draft if useful, then confirm the source and approve manually. Applied factual suggestions create linked **UNREVIEWED** Claim/ClaimSupport records. Human review of quotations is still necessary; text presence does not prove that the chosen classification is correct.

The review retains extraction run/selected-field provenance. Reopening a hashed article source preserves that article's actual retrieval timestamp. Closing during extraction does not approve or apply anything; reopen and select the retained run after it completes. The editor lists the latest five runs for the source.

## Evaluate using saved reviews

1. Open **News & reviews → Extraction quality · manual pilot**.
2. Choose a saved review and click **Extract selected saved case**. This deliberately makes another full-article/provider request; it changes no approved event.
3. Click **Compare with saved review** on the completed run. The reference is the latest immutable source-review graph for that exact source, not the current event graph after later news updates. Reference graphs and labels are not sent to the provider.
4. Inspect exact agreement, review-field coverage, unadjudicated suggestions and differences. Run comparisons again after correcting a reference review. Old comparisons remain versioned but are excluded from the current summary.
5. Compare extractor/model versions on a fixed case set. The summary uses only the latest attempt per source and model/extractor version, and only evaluations matching the current review version within the latest-100 window. It reports source counts and event/programme group counts, so repeated updates are visible rather than treated as independent evidence.

**Exact agreement** is correct comparable fields / proposed fields with a populated, uniquely aligned review reference. It is agreement with saved reviews, not externally verified factual accuracy. **Coverage** is populated reference fields reached by comparable suggestions / all populated reference fields in the supported extraction schemas. Wrong comparable values reduce agreement but still count as covered. **Unadjudicated** suggestions have no populated reference or no unique matching record; they are not counted as correct or silently discarded. Unknown values do not count as positive reference facts.

Failures and in-progress cases are reported separately and cannot be hidden by an earlier successful run. Field agreement/coverage cover scored successful cases; inspect failure counts before judging readiness.

A saved source-review graph can retain facts from earlier announcements. Its populated-field coverage is therefore not a claim of recall against this article alone. Use a source-adjudicated reference set to measure article-level recall before enabling background extraction. Duplicate suggestions for the same reference field are reported as unadjudicated rather than counted repeatedly.

Reference alignment is conservative: entity legal names, party role/entity, instrument type/borrower, economic-leg participants/type, workstream type, condition type/authority and Nordic country/entity. Ambiguous or newly named records need human adjudication. ISO timestamps and exact monetary decimals are normalized for comparison; other text comparisons ignore case/whitespace. Semantic paraphrases can therefore be reported as differences.

Older reviews usually predate full-text snapshots. Such evaluations are labelled retrospective: the current article may differ from what the reviewer originally saw. Extraction before approval has a different limitation: applied suggestions may influence review agreement. Inspect both; neither alone is an independent accuracy claim.

Start with 10–20 varied saved cases (acquisition, disposal, bid, financing, completion update and reporting/no-event cases). Adjudicate mismatches and missing-reference facts, then freeze a held-out set by event/programme group before improving the extractor. Do not tune prompts using the held-out answers. Compare per-field and event-type failures as well as overall coverage. Record IDs, article hashes, source-review versions and extractor/model versions remain available for reproducibility.

Background extraction requires a future explicitly reviewed change after the held-out results and failure handling are satisfactory. There is no activation button or automatic pass threshold in this release.

## Boundaries and retained evidence

Supported suggestions cover corporate-event classifications/dates, parties and roles, explicit Nordic connections, funding instruments/rates/currencies/amounts, cash flows, independent workstream states and conditions/deadlines. Hedge products, inferred exposures, FICC scores and probabilities are excluded. A committed loan is not automatically a draw; enterprise value is not a cash leg; reporting currency or domicile does not establish transaction/funding currency; one completed workstream does not establish overall completion. Month/quarter dates are not forced into invented days where the target field lacks a matching date-precision attribute.

Full-text fetches allow public Cision announcement URLs only, validate every redirect, do not follow attachments or off-site links, and enforce 15-second / 2 MB page limits. Article text is capped at 80,000 characters without silent truncation. Suggestions are capped at 25 records / 60 fields; each proposed field needs a 12–800 character exact quotation. Schema, enum, reference and financial consistency checks run before suggestions are retained. Failures are recorded separately; they do not erase drafts or approve events. Extraction may miss facts even when all validations pass.

Pin a provider model snapshot for controlled comparisons when available. The retained suggestion artifact includes the provider-reported model ID and request hash; an unpinned model alias can change behind the same configured name.

The provider sees the normalized public article text, publication timestamp and fixed vocabulary, not prior reviews or private model graphs. Full source snapshots, text, hashes, parser version, provider model name, extractor version, quotations/offsets and failures are retained in server-written tables. Invited reviewers can read them; ordinary pilot members cannot. The pilot limits requests to 20 per reviewer per hour and one active extraction per source. A timed-out source lock expires on a later manual retry.

This is an evaluated extraction workflow, not model training. Saved corrections provide reference labels and existing field-level audit; changing model weights or learning an extraction policy from those labels is not implemented here. Existing relevance-ranking learning remains separate.
