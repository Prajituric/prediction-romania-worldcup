
CREATE TABLE public.bets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

GRANT ALL ON public.bets TO service_role;

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

-- No public policies: app uses custom users table; all bet access is via server functions using service role.

CREATE INDEX bets_user_id_idx ON public.bets(user_id);
CREATE INDEX bets_match_id_idx ON public.bets(match_id);
CREATE INDEX bets_resolved_idx ON public.bets(resolved) WHERE resolved = false;

ALTER TABLE public.actual_results
  ADD COLUMN IF NOT EXISTS group_standings_actual JSONB NOT NULL DEFAULT '{}'::jsonb;
