
CREATE TABLE public.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.users TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  group_rankings JSONB NOT NULL,
  knockout_picks JSONB NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.predictions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.predictions_id_seq TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.actual_results (
  id SERIAL PRIMARY KEY,
  group_rankings_actual JSONB NOT NULL,
  knockout_results_actual JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.actual_results TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.actual_results_id_seq TO service_role;
ALTER TABLE public.actual_results ENABLE ROW LEVEL SECURITY;
