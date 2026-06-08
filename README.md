# World Cup 2026 Bracket Predictor

A full‑stack TanStack Start app that lets anyone predict the entire 2026 FIFA World Cup — 48 teams, 12 groups, top 2 + 8 best 3rd‑place teams advance into a fixed Round‑of‑32 knockout bracket using the official FIFA pairing table.

## Stack
- **Frontend & backend:** TanStack Start (React 19 + TanStack Router + Vite + server functions)
- **Database:** Lovable Cloud (PostgreSQL via Supabase) — accessed from server functions with the service role key
- **Styling:** TailwindCSS v4
- **Auth:** none — users identify by a unique name only

> Note on Drizzle: the original spec asked for Drizzle ORM. Lovable Cloud deploys server functions to a Cloudflare Worker runtime, where Drizzle's `pg` driver doesn't run without extra setup. The database schema and constraints match the spec exactly; the queries are issued through the Supabase client (functionally equivalent for these CRUD operations and Worker‑compatible).

## Routes
| Path | Purpose |
| ---- | ------- |
| `/` | Name entry — registers / loads the user |
| `/predict/group` | Rank each of the 12 groups (1st–4th). Stored in localStorage. |
| `/predict/bracket` | Fully interactive 32 → 16 → 8 → 4 → 2 → Final bracket, resolved from the user's group rankings |
| `/leaderboard` | All users ranked by points (1 per correct knockout match) |
| `/admin/results` | Password‑protected page to enter the actual group standings + knockout winners; saving recalculates every user's score |

## Server functions (`src/lib/wc/predictions.functions.ts`)
- `registerUser({ name })` → `{ userId, name }`
- `savePredictions({ userId, groupRankings, knockoutPicks })`
- `getUserPrediction({ userId })`
- `getLeaderboard()`
- `getActualResults()`
- `adminSetActualResults({ password, groupActual, knockoutActual })` — verifies password, persists, recalculates all users
- `resolveBracketFromActual({ groupRankings, picks })`

## Bracket logic (`src/lib/wc/bracketResolver.ts`)
- Implied points: 1st = 9, 2nd = 7, 3rd = 4, 4th = 0. Tie‑break: alphabetical.
- Implements the official FIFA 2026 R32 pairing table verbatim, including the `3C/D/E` style picks and the special R32_16 slot (best remaining 3rd vs. highest remaining runner‑up).
- The full tree (R16 → Final) is generated dynamically from R32 winners.

## Environment variables
```
DATABASE_URL=…           # provided by Lovable Cloud automatically
VITE_ADMIN_PASSWORD=admin123
```
Lovable Cloud auto‑configures Supabase env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.). Change `VITE_ADMIN_PASSWORD` before deploying to production.

## Database schema (created via Lovable Cloud migration)
```
users(id serial pk, name varchar unique, created_at timestamptz)
predictions(id serial pk, user_id int unique fk users, group_rankings jsonb,
            knockout_picks jsonb, points int default 0, created_at timestamptz)
actual_results(id serial pk, group_rankings_actual jsonb,
               knockout_results_actual jsonb, updated_at timestamptz)
```

## Scoring
`points = number of knockout matches (R32 → Final) where the user's pick matches the actual winner`.

Recalculation happens automatically when an admin saves new actual results.

## Run locally
```bash
bun install
bun run dev
```
