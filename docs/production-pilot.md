# Production pilot — Stage 1 validation

Stage 1 prepares **invite-only sign-in and persistent PostgreSQL reads**. It does not start news monitoring or send notifications. The existing five-view synthetic demo remains available in local/Codespaces development with `APP_MODE=demo` (the default). Pilot mode starts empty and never reads SQLite or seeds synthetic transactions.

## Validation gates

1. **This stage:** deploy the reviewed branch, verify invited sign-in, access restrictions and persistence. No live feeds or notifications.
2. **Next, after your validation:** connect one official feed, add candidate review and atomic event tracking in PostgreSQL, with a durable notification outbox and per-user subscriptions. Review the source coverage and generated analysis before enabling collection.
3. **Then:** authorize a single test notification to your iPhone and verify retries, duplicates, click-through and opt-out. Only enable regular monitoring after that test passes.

No Supabase project, Vercel deployment, live feed or device notification has been created by the code preparation in Stage 1. Account actions below take place in your browser. Choose your provider plans and review their usage limits before accepting paid services.

## 1. Review the code in GitHub

The changes are on branch **production-pilot-stage-1** of `rodelius/nordic-ma`. Review the comparison with `main` and merge once satisfied. Your existing local demo data is ignored by Git and is not copied into Supabase. Do not upload or delete it.

## 2. Create Supabase

1. Open <https://supabase.com/dashboard> and create a project. Choose a suitable European region. Store its database password securely; this application does not need that password or a service-role key.
2. Open **SQL Editor → New query**. Copy the complete contents of [`supabase/migrations/202610240001_pilot_foundation.sql`](../supabase/migrations/202610240001_pilot_foundation.sql) from GitHub and run it **once**. It creates four new tables, row-level security policies, read-only grants and a schema marker. It does not insert any transaction records. Use a new project for this pilot rather than an existing business database.
3. Under the project's API/connect settings, locate the **Project URL** and **publishable key** (legacy anon key also supported). These become `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Do **not** use a secret/service-role key.
4. Disable self-service new-user signups in the Supabase Auth settings, then in **Authentication → Users**, invite your own pilot email address. It must exist before sign-in because the application does not allow automatic account creation. You will use the application's sign-in form after configuring its URL below.
5. Enable your account in the SQL editor. Replace the example address locally in the editor (not in Git or chat):

   ```sql
   insert into public.pilot_members(user_id)
   select id from auth.users where lower(email) = lower('your-pilot-email@example.com')
   on conflict (user_id) do update set enabled = true;
   ```

   The editor should report one affected row. If zero, check that the user exists in Authentication → Users.

The pilot is a **single shared workspace** for explicitly enabled members. It is not yet a multi-tenant product. A disabled or unlisted user has no database read permission. Client writes are denied even to enabled members.

## 3. Deploy to Vercel

1. Open <https://vercel.com/new> and import **rodelius/nordic-ma** after merging the reviewed Stage 1 branch into `main`. Confirm the deployment uses the merged Stage 1 commit, not the earlier demo code.
2. Keep the repository root as the application root. Framework: **Next.js**. Node.js: **24.x**. Use the normal `npm run build` command. Do not configure a custom command that starts the development server.
3. Add these **Production** environment values securely in Vercel settings:

   | Name | Value |
   | --- | --- |
   | `APP_MODE` | `pilot` |
   | `APP_URL` | Your exact production HTTPS origin, for example `https://your-chosen-project.vercel.app` |
   | `SUPABASE_URL` | Your Supabase project's HTTPS URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Its publishable/anon key, never its secret/service-role key |

   If the production hostname is assigned only after the first deployment, copy the actual hostname into `APP_URL` and redeploy. An incompletely configured Stage 1 deployment returns **503** rather than exposing the demo or falling back to SQLite. Production variables do not automatically configure Vercel Preview deployments; use the production URL for this validation.
4. Deploy. A failed setup must not be worked around by setting demo mode or removing access checks.
5. In **Supabase → Authentication → URL Configuration**, set **Site URL** to the same `APP_URL`. Add the exact allowed redirect URL `https://your-production-host/auth/callback`. Avoid wildcard redirect URLs for this stage.
6. For a very small pilot, check Supabase's current default email-delivery restrictions. Default SMTP can restrict recipients to organization members and has low limits. Add your own organization-member email or configure custom SMTP in Supabase before expecting delivery to other users. Do not put SMTP credentials in this repository. Review delivery failures in Supabase Auth logs; a generic sign-in response does not prove an email was delivered.

No AI, ingestion, VAPID or service-role credentials are required for Stage 1. Leave them unset. Existing demo bearer tokens cannot authorize pilot writes.

## 4. Your validation checklist

Use the actual production URL from Vercel. A generated branch-preview URL is a separate deployment and is not the sign-in redirect target configured above.

- [ ] Open the URL in a private browser window. It redirects to `/login`, not the dashboard.
- [ ] Open `/api/deals` in that signed-out window. It returns **401** and no transaction data.
- [ ] Enter your enabled pilot email at `/login`. Open the latest magic link **in the same browser** that requested it. The flow uses PKCE, so another browser or device will not have the matching verifier cookie. An expired link requires a new request.
- [ ] The dashboard opens with **PILOT / STAGE 1**, zero transactions and all five views available. There are no synthetic deals in Supabase.
- [ ] Click **Check connection** in the dashboard header, or open `/api/readiness` while signed in. It returns `mode: "pilot"`, `readOnly: true`, `database: "reachable"`, `foundationVersion: "stage-1"`, and `liveIngestion: false`, `notifications: false`.
- [ ] Prove persistent storage: run this owner-only SQL in Supabase:

  ```sql
  insert into public.monitor_state(key,value) values ('validation_marker','pilot-check-1')
  on conflict (key) do update set value = excluded.value;
  ```

  Refresh `/api/readiness`: it now contains `validationMarker: "pilot-check-1"`. Redeploy the same commit in Vercel, sign in again if needed, and confirm the marker remains. This exercises database persistence rather than a local build artifact.
- [ ] Click **Sign out**. Reopening the dashboard or API requires sign-in again.
- [ ] While signed in, disable your membership using the owner SQL editor:

  ```sql
  update public.pilot_members set enabled = false
  where user_id in (select id from auth.users where lower(email)=lower('your-pilot-email@example.com'));
  ```

  Refresh `/api/deals`: it returns **403**. Re-enable membership with `enabled = true` after the test.
- [ ] Confirm Analyze source / Record event / notifications remain unavailable in pilot mode. No background monitoring or notification job is configured.

Send back **the production URL and which checklist items passed or failed**. Do not send passwords, API keys, session cookies or sign-in links. After you validate this foundation, proceed to Stage 2 as a separate reviewed change.

## Testing and boundaries

Local unit tests exercise the actual migration in PostgreSQL-compatible PGlite, including RLS isolation, disabled membership, anonymous denial, blocked writes and rejecting synthetic data. The app's production build and unchanged demo workflows are tested independently. Local tests are not a claim that Supabase email delivery, cloud deployment or device notifications work; those require the checklist above.

RLS uses verified Supabase user sessions. The application has no service-role key. Authenticated pages/API responses are marked private/no-store. Sign-in returns the same generic message for existing and nonexistent email addresses. Stage 1 does not add an application-level abuse/rate-limit service; Supabase provider limits still apply. Before expanding beyond the pilot, add application rate limits and production SMTP. Supabase membership revocation takes effect on subsequent server reads; already-displayed data in a browser cannot be recalled.
