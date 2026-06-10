
CREATE TABLE public.push_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);

CREATE TABLE public.notified_matches (
  match_id INTEGER PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.notified_matches TO service_role;
ALTER TABLE public.notified_matches ENABLE ROW LEVEL SECURITY;
