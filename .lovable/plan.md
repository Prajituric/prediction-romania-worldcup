This is a large multi-part change. Here's how I'll approach each piece, with a few points where I need your input before I start.

## 1. Edge function deploy + secrets + cron
- Add `FOOTBALL_API_TOKEN` to Supabase secrets (server-side env). It's already in `.env` for local server functions, so no code changes needed there.
- Deploy `sync-wc-results`.
- Schedule it via `pg_cron` to call the edge function URL every hour at minute 5 (`5 * * * *`), authenticated with the service role bearer token (same pattern as the existing GitHub Action). The GitHub Actions workflow becomes redundant — I'll leave it in place unless you want it removed.

## 2. `bets` table
Migration exactly as you specified, plus:
- GRANTs (`authenticated`, `service_role`)
- RLS enabled
- Policies: a user can read/write only their own bets (matched by `user_id` against the session's user id). Since this app uses a custom `users` table (no Supabase Auth), bet writes will be done via server functions using the service role — RLS will deny direct anon access. That keeps things safe.

## 3. `src/lib/wc/bets.functions.ts`
- `saveBet({ userId, matchId, homeScore, awayScore })` — upsert on `(user_id, match_id)`.
- `getUserBets({ userId })` — list bets.
- `resolveBets()` — fetches finished matches from the football-data API (the only place per-match scores live; `actual_results` only stores knockout winners and group standings, not individual match scores), compares against each unresolved bet, awards 10 / 3 / 0, marks `resolved=true`, and adds the delta to `predictions.points` for that user.
- The existing localStorage `bets.ts` helper is now obsolete — I'll keep it for now and migrate the UI in a follow-up unless you want me to rewire the betting UI in this turn too.

## 4. Edge function calls `resolveBets`
Edge function is Deno and can't import the TanStack server function. I'll **mirror** the resolve logic inside `sync-wc-results/index.ts` (same pattern as scoring is already mirrored there) so it runs at the end of every sync.

## 5. `group_standings_actual` column
- Migration adds JSONB column (nullable, default `'{}'`).
- Edge function populates it from the standings API: `{ A: [{team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points}, ...], ... }`.

## 6. Push notifications (needs your input)
The service worker already handles `push` events, but to actually send push notifications I need to build:
- **`push_subscriptions` table** to store each browser's subscription JSON keyed by user.
- **VAPID keys** — required by the Web Push protocol. I'll generate a keypair and store the private key as a secret; the public key needs to be exposed to the client.
- **Client subscribe flow** — a button (probably in the header or schedule page) that asks for notification permission and registers the subscription.
- **Sender** — a server route `/api/public/hooks/send-match-reminders` that finds matches starting in 3–4 hours that haven't been notified yet, sends pushes via the `web-push` library, and marks them sent.
- **Cron** — `pg_cron` every 15 minutes hitting that route.
- **Dedup** — a `notified_matches` table (or column on bets/matches) to avoid resending.

**Questions before I build #6:**
1. **Who gets the reminders** — all subscribed users globally, or only users who have an unfilled bet for that match?
2. **Where should the "Enable notifications" button live** — site header, schedule page, or a dedicated settings screen?
3. **Generate VAPID keys now** — I can generate them in the sandbox and store the private key via the secrets tool. OK to proceed?

If you want me to defer #6 and ship 1–5 now, say so and I'll start. Otherwise answer the three questions and I'll do everything in one pass.