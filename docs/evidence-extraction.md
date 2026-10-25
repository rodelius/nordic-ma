# Full-article extraction: Python rules pilot

Extraction now uses a deterministic Python parser, not an AI provider. It runs entirely on standard-library text rules and makes **no OpenAI requests or AI token charges**. Ordinary Vercel and Supabase hosting/storage usage still applies.

Migration 010 is storage-only and engine-neutral: it retains extraction runs, quotations and evaluation results. Python belongs in application code, not in a Supabase SQL migration. **The SQL file has not been changed.**

## Release and browser-only setup

1. Review the updated `evidence-extraction` branch/PR and green verification run. It includes the original extraction workflow and this rules-engine replacement.
2. If the database is through 009, apply **only `202610250010_evidence_extraction.sql`**. If 010 was already applied, **run no SQL for this update**. Do not rerun older migrations.
3. Keep existing server-only `APP_URL`, `SUPABASE_SECRET_KEY` and reviewer-stage settings in Vercel. `APP_URL` must be this deployment's exact HTTPS origin. No AI_API_KEY or AI_MODEL is required or read; any old AI variables can be removed.
4. Merge/deploy. Vercel deploys `api/rule_parser.py` as a Python function alongside Next.js. `vercel.json` includes its `python/**` implementation files. No pip packages, model downloads or external parser service are needed.
5. Open **News & reviews → Review → Full article & suggestions → Extract full article**. Check the quotations and rule IDs, apply selected fields to the draft, and approve manually.
6. Open **Extraction quality · manual pilot** to compare parser suggestions with saved reviews. Start with varied cases and inspect omissions and failures as well as agreement.

The application fetches the public Cision article, then sends its normalized text to its own signed Python endpoint. The Python function cannot fetch links, call an AI provider, approve events or access the database. Internal request signatures are short-lived and bound to the exact body, using a domain-separated key derived from the existing server worker secret. The secret itself is never sent in HTTP headers or the body. Unsigned requests receive 403.

For Codespaces/local development, install Python 3 (3.12 is tested) and Node 24; the devcontainer now installs Python automatically. The Next.js route invokes the same parser as a bounded local subprocess using stdin, without a shell. Vercel Node functions do not assume a Python executable exists: they use the Python function instead. Manual reviewer and source-selection checks remain in the Next.js route.

If production reports `Python parser returned HTTP 404`, inspect Vercel's deployment Functions list and verify `api/rule_parser.py` is included and `APP_URL` points to that deployment. A 403 from the parser indicates a signing/environment mismatch. A direct unsigned browser request returning 403 is expected. Local Python/function integration is tested; authenticated production deployment remains a release-validation step.

## What the rules do

`python/corporate_parser.py` contains versioned, inspectable rules. Each suggested field includes a literal source quotation and rule ID. Typed enum/reference/financial validation still runs in the application before suggestions are retained.

The initial vocabulary covers explicit public offers, private-acquisition phrases, mergers, divestitures, spin-offs, rights issues, IPOs, refinancing, bond issues and strategic reviews. Selected Nordic transaction phrases are recognized; broad multilingual semantic understanding is not claimed. Supported party patterns identify named buyers, targets, sellers and borrowers with recognizable company-name forms. Unsupported names or phrasing stay unpopulated rather than being guessed.

Context checks separate:

- committed funding from drawn funding and proposed facilities;
- future availability from a present financing commitment;
- event completion from financing completion and expected closing dates;
- explicit domicile from headquarters or Nordic-sounding names;
- funding currency from reporting currency, enterprise value, revenue or consideration;
- exact dates and amounts from ambiguous separators, partial dates and unspecified currency symbols.

Numbers use Python Decimal with explicit scales, not floating-point calculations. Ambiguous `1,500` / `1.500` values remain unassigned. A bond's reported face amount is not automatically recorded as committed or drawn funding; the parser leaves a review note when the target model has no appropriate populated amount field. Month/quarter dates are not converted into invented days. Conflicting statements remove the affected suggestion and create a review note.

The parser deliberately creates no hedge records, inferred exposures, FICC scores or completion probabilities. It does not treat a single approval as overall regulatory clearance. Missing facts, unsupported event language, unusually long sentences and complex multi-party or multi-instrument structures require manual review. This first ruleset will have lower coverage than a general language model on unfamiliar prose; benchmarking makes that visible.

## Review workflow and retained evidence

Full text comes from the article body, never a substituted feed excerpt after retrieval failure. The pilot retains article text/hash/retrieval time, parser version, matched rule IDs, review notes, source-review version and failures. Each applied field creates a linked UNREVIEWED claim. Review provenance is checked against a real completed extraction for the selected source.

Reviewers choose which suggestions to apply; unselected fields remain unchanged. Applying selected values can overwrite current draft values. Include referenced party records when selecting roles/financing. Identity matching is conservative; ambiguous matches become new draft records instead of silently merging instruments or parties. Reopening a hashed article source preserves its actual retrieval time.

No background extraction is enabled, and existing collection/delivery settings are unchanged. Extracting or benchmarking never approves events or sends alerts. Existing rows from an earlier provider-based pilot remain available for historical comparison; new runs use the `python-rules` engine and `python-rules-v1` ruleset. The old excerpt-to-whole-graph `/api/analyze` endpoint remains retired (410).

## Measure agreement and coverage with saved reviews

1. Open **News & reviews → Extraction quality · manual pilot**.
2. Choose a saved case and click **Extract selected saved case**. It retrieves the current full article and runs Python without AI token usage.
3. Click **Compare with saved review**. The reference is the latest immutable source-review graph for that exact source, not a later active event graph. No reference answers are fed into the parser.
4. Inspect exact agreement, populated-review-field coverage, unadjudicated suggestions, per-record differences and failed latest attempts. Compare again after correcting a reference review; stale comparisons are excluded from the current summary.

Agreement is correct comparable suggestions / suggestions with a populated, uniquely aligned reference. Coverage is unique populated reference fields reached / populated reference fields in the supported schemas. Wrong comparable values reduce agreement but still count as covered. Missing/unknown references, ambiguous identity matches and duplicate suggestions are not silently counted as correct. Failures are reported separately and cannot be hidden by an earlier successful run.

The summary uses the latest attempt per source/engine/ruleset, current review versions only, within a latest-100 window. It reports source and event/programme group counts. Multiple updates for the same programme must not be treated as independent held-out examples. Record alignment uses names, participants and record-specific identity fields; ambiguous matches need adjudication. Monetary decimals and ISO timestamps are normalized for exact comparison; other text comparisons ignore case/whitespace.

These are saved-review agreement metrics, not independent proof of factual accuracy. A review graph may retain facts from earlier announcements, so its coverage is not article-level recall. Older reviews may also predate retained full-text snapshots: current article text can have changed. New reviews may be influenced by applied suggestions. Use a source-adjudicated, frozen evaluation set to judge extraction readiness.

Start with 10–20 varied cases. For each failure/omission, preserve a representative quotation, correct output and regression test. Improve a named rule, bump the ruleset version when behavior changes, and compare old/new results on a held-out set grouped by event/programme. Do not tune rules against held-out answers. User corrections remain reference labels and audit; the parser does not silently learn or rewrite its own rules.

There is no background activation switch or automatic pass threshold. Background parsing requires a later explicitly reviewed change after quality and failure handling are satisfactory.

## Limits and verification

Article retrieval permits public Cision announcement URLs only, checks redirects and excludes off-site links/attachments. Limits: 15-second / 2 MB page fetch, 80,000-character article, 25 records / 60 fields, 12–800 character literal quotation per field. The pilot retains one active run per source and a 20-run/hour reviewer limit. These protect server resources, not AI spending. A stale worker expires on the next manual retry.

Run `python -m unittest discover -s python -p 'test_*.py'`, `npm test`, `npm run build`, API/pilot checks and desktop/mobile Playwright tests. Python tests cover realistic positives and counterexamples, Decimal/date handling, negation, quote/rule provenance and the signed HTTP function. Node tests execute the actual Python parser with no AI key and assert that no provider request occurs. Cloud tests use the signed function contract; production validation still requires your authenticated Vercel/Supabase pilot.
