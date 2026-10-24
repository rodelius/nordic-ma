# Stage 2 — general Cision announcement tracking and reviewed notifications

Stage 1 has been validated by the project owner at **https://nordic-ma.vercel.app**. This stage adds one source, an analyst review queue, persistent updates and a durable push outbox. The source is Cision's general issuer-announcement feed, not a single-company feed. It is a bounded, analyst-reviewed pilot, not full Nordic news or rumour coverage.

**Do not re-run migration 001. Do not remove existing tables or data.** Collection and delivery default to disabled. The existing local synthetic demo and five dashboard views remain available.

## A. Review and deploy the code

1. Review branch `production-pilot-stage-2` against `main`, create a pull request, and merge when satisfied. Existing Stage 1 mode continues until you explicitly enable Stage 2. Wait for Vercel to finish deploying the new code (with `PILOT_STAGE` still unset or `1`) before applying migration 002; the earlier Stage 1 binary does not recognize the new schema marker.
2. In Supabase's SQL editor, apply [`202610240002_live_pilot.sql`](../supabase/migrations/202610240002_live_pilot.sql) once if you have not already applied it, then apply [`202610240003_cision_review.sql`](../supabase/migrations/202610240003_cision_review.sql). If migration 002 is already installed, apply **only 003**. Do not re-run 001 or 002. It adds source candidates, your subscriptions, the notification outbox, deliveries, source run logs and narrowly granted review/worker functions. It also adds `can_review` to pilot memberships and updates the schema marker. Migration 003 adds the source-supported Nordic-connection approval gate and works with the earlier Stage 2 database. Neither migration fetches a feed or sends an alert.
3. Grant yourself review access using your own email in the SQL editor:

   ```sql
   update public.pilot_members set can_review = true
   where user_id in (select id from auth.users where lower(email)=lower('your-pilot-email@example.com'));
   ```

   Confirm one row changed. Ordinary invited members can read the shared workspace and manage their own subscriptions, but cannot approve/dismiss candidates or run scans.
4. Add these **Production** environment values in Vercel. Keep the Stage 1 URL, publishable key and `APP_MODE=pilot` unchanged:

   | Name | Initial value |
   | --- | --- |
   | `PILOT_STAGE` | `2` |
   | `SUPABASE_SECRET_KEY` | Your project's server-only secret key, or legacy service_role key |
   | `SOURCE_FEED_URL` | `https://news.cision.com/ListItems?format=rss` (replace any old Addtech value) |
   | `MONITORING_ENABLED` | `false` |
   | `NOTIFICATIONS_ENABLED` | `false` |
   | `CRON_SECRET` | A random server-only secret of at least 32 characters, generated with your password manager |

   The worker credential is privileged. Use only Vercel's secure environment settings; never put it in Git, a `NEXT_PUBLIC_` variable or chat. Only source scans and the bounded delivery worker use it. Normal dashboard reads and reviews still use your session and database access policies.
5. Redeploy. Open `/api/readiness` while signed in. Expect `stage: 2`, `foundationVersion: "stage-2"`, `readOnly: false`, `liveIngestion: false`, `notifications: false`. This reports configuration and database connectivity, not a claim of live collection or successful delivery.

## B. Validate one live source

1. Open **Alerts & catalysts → Cision announcement review**. Click **Scan official feed**.
2. Confirm the latest source run is **ok**, with its timestamp and candidate count. A failed fetch must show **failed**; it must not advance the last-successful-ingestion checkpoint.
3. The verified endpoint is **<https://news.cision.com/ListItems?format=rss>**. It was discovered from Cision's own RSS control and returned HTTP 200 and valid RSS from the Codex machine on 24 October 2026. A bounded live scan fetched 500 announcements across five pages and found 51 broad M&A candidates. Those were not approved transactions or confirmed Nordic opportunities, and no data was inserted into your production database by that test. Open one candidate's original Cision story to verify that the record matches its issuer announcement.
4. Scan again. The same items must not be duplicated. The run count reports qualifying feed entries, including already-seen entries; it is not a count of newly inserted records. Source entries with changed content become new review candidates; they are not automatically declared material.
5. **Zero candidates is a valid outcome.** This pilot fetches up to five 100-item pages from the general Cision feed and screens entries dated within the last seven days for broad acquisition/disposal/process keywords. Publication times are taken from individual items, not the feed channel timestamp. Routine own-share transaction headlines are excluded. Remaining candidates still require manual review. No qualifying recent announcement means no invented transaction and no market alert. A scan-cap warning (`coverageLimited: true`) means the seven-day window was not fully fetched. The live verification reached that cap; its oldest fetched item was 19 October 2026 at 14:00 Stockholm time. Page limits, changing pagination and daily scan cadence can miss announcements; this pilot does not claim exhaustive coverage. Pending queues display up to 100 records at a time and show the total when more are waiting. The self-test in C does not depend on fresh news.

No arbitrary article URLs are fetched automatically. Only the general `news.cision.com/ListItems?format=rss` RSS endpoint is fetched with bounded pagination; story links must be HTTPS Cision release URLs. Redirects, DTDs/entities and oversized responses are rejected. Headlines and excerpts are retained. Search or issuer filters in `SOURCE_FEED_URL` are rejected to prevent accidental return to single-company coverage. Open the full source yourself: the excerpt can omit important currencies, financing terms or conditions. This is not a full-source search or automatic entity-resolution service.

## C. Validate one iPhone test notification

Do this **before** approving market events. You can inspect the source queue while notifications are off.

1. In the browser Codespace terminal, generate a VAPID keypair with:

   ```sh
   npx web-push generate-vapid-keys
   ```

   Enter the resulting `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and a real `VAPID_SUBJECT` (`mailto:your-contact-address`) securely in Vercel. Do not share the private key in chat. Keep the same keypair across deployments; rotating it invalidates subscriptions made with the old public key.
2. Set **`NOTIFICATIONS_ENABLED=true`**, keep **`MONITORING_ENABLED=false`**, and redeploy.
3. On iPhone running iOS 16.4 or newer, open the production site in Safari, add it to the Home Screen, then launch it from that icon and sign in there. Request and open the magic-link email in the same browser context; iOS may open a link outside the installed app. If session transfer fails, report that behavior before assuming push is broken. No iPhone delivery has been verified by Codex.
4. Tap **Enable alerts**, then accept notification permission. In the review panel, click **Queue one test alert**, followed by **Deliver queued alerts**. Both actions are explicit; merely deploying or opening the page does not send a test.
5. Expect **TEST · Nordic FICC**, with text saying this is a delivery test, not a transaction. Click it and confirm the app opens. Try delivery again: the sent job must not resend. Test queuing is idempotent within the same UTC minute, and targets only your active subscriptions. It does not create a deal.
6. Verify your delivery history shows **sent**. This means the browser push service accepted the request, not proof that the device displayed it; your observation is the actual device check.
7. Test **Disable my alerts**. It disables all your server subscriptions and attempts to unsubscribe the current browser. Future jobs must not be dispatched to disabled subscriptions. An already-dispatched notification may still arrive. Re-enable alerts only if you want to continue the pilot.

## D. Validate a reviewed transaction and an update

1. Select a pending candidate and click **Review**. Choose **New transaction**, or explicitly attach it to a tracked deal if this is an update. Name-based matching is not automatic. The general feed includes non-Nordic issuers; a geography hint or a currency mention is not sufficient to approve one.
2. Complete the structured analysis. The buyer and connection country deliberately start unknown. Set `country` to the verified Nordic connection (Sweden/Norway/Finland/Denmark), and add an evidence entry labelled **Nordic connection**, with kind **Fact** and source-supported details about a buyer, seller, target, sponsor or material asset. Both the application and database reject approval without this entry. Verify transaction parties, source date, status, score, potential FX notional, currencies and evidence. Keep unknowns explicit; EV is not an FX notional. **Draft with AI** is optional and requires the existing server `AI_API_KEY`. It sees the headline and RSS excerpt only, not the whole article. It cannot publish anything by itself.
3. Tick the evidence-review checkbox and approve. The database binds the decision to your authenticated reviewer identity and the source's original URL/time. A single transaction records the review, event, latest deal state and any eligible outbox/delivery rows together.
4. Verify the deal appears in the radar, its evidence opens, and the morning brief shows the change. For an existing deal, stale, terminal or unchanged updates remain in history but do not replace the latest deal state or queue alerts. Use stage **Closed** or **Failed** exactly for terminal events.
5. A recent material approved event with FICC score **3+** queues alerts to members who were opted in at approval time and meet the score threshold. Announcements older than **24 hours** can be reviewed/tracked but will not alert. Subscribing later does not retrospectively deliver old approvals.
6. Click **Deliver queued alerts** for immediate validation. Verify the notification opens the correct deal. Repeated approval of the same source must not enqueue it again. Low-relevance or non-material updates must not alert.

Send back the production URL, successful source-run timestamp, candidate count, and whether the test and deal notifications appeared and opened correctly. No API keys, subscription endpoints, cookies or sign-in links.

## E. Enable ongoing collection only after B–D pass

The repository includes one Vercel Cron call to `/api/jobs/run` at **06:00 UTC daily** (07:00 Stockholm winter / 08:00 summer). It is a low-frequency pilot schedule compatible with daily-only hosting plans, **not real-time news detection**. Vercel supplies `Authorization: Bearer CRON_SECRET`; missing/incorrect secrets fail closed. On Vercel Hobby, execution may be within a wider scheduling window, not an exact minute.

After validation, set `MONITORING_ENABLED=true` and redeploy to activate scheduled collection. Keep `NOTIFICATIONS_ENABLED=true` only if you want delivery of reviewed events. Each run collects candidates and processes up to five due delivery jobs; it never auto-approves a news item. Use manual delivery while testing. Review provider plan support before changing the schedule to every 5–15 minutes. More frequent collection and delivery require a suitable scheduler/hosting plan; this change has not purchased or activated one.

Market alerts expire 24 hours after the source publication; self-tests expire after one hour. Expired alerts are marked dead instead of being delivered as fresh opportunities. Automatic delivery retries use exponential backoff (capped at one hour) and stop after six attempts. The actual retry opportunity depends on the worker cadence; with daily cron a retry may wait until the next day. Delivery batches use leases and skip locked rows. Expired leases can be reclaimed after two minutes; HTTP 404/410 endpoints are disabled. Other transport failures are retried, including acknowledgement failures. Delivery is **at least once**, not exactly once: a push service can accept a message before an acknowledgement is lost. Stable browser tags reduce visible duplicates but cannot guarantee suppression on every device.

Approval is the notification authorization for a market event. Disabling collection does not disable queued deliveries; set `NOTIFICATIONS_ENABLED=false` as well to pause delivery. Neither switch deletes tracked history, pending items, subscriptions or the outbox. Keep the server credential and cron secret private, and review provider logs for failures. Use `/api/readiness` for configured flags and the source/delivery panels for actual run outcomes.

## Verified locally vs. still requiring your validation

Local automated tests execute both migrations, test reviewer/reader isolation, review/outbox atomicity, idempotency, terminal-deal handling, retry claims, private subscription visibility, RSS parsing/filtering and unsafe push destination rejection. Demo, build and HTTP gates are also checked. Live Cision feed access and bounded parsing were verified separately from unit tests. The tests do not establish your Supabase cloud migration, production source scanning, Vercel scheduler execution or iPhone delivery. Those are the explicit validation steps above.

## Source limits and quality

Cision is an issuer-distribution source. It does not cover every press rumour, privately run process, regulator filing, adviser mandate or licensed news report. Global M&A matches can include holdings disclosures, unrelated acquisitions, historic narrative and other noise. Country and fund currencies are never inferred as facts just from a newsroom name. Reviewers must reject non-Nordic or irrelevant items and distinguish facts, assumptions and unknowns. Exact content duplicates are suppressed; translations and rewritten stories can remain separate candidates and should be matched/dismissed by the reviewer. Broader sources and semantic/entity matching are later increments after this pilot is validated.
