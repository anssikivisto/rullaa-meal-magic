CREATE TABLE public.taste_profile (
  user_id UUID PRIMARY KEY,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  dislikes TEXT,
  default_servings INTEGER NOT NULL DEFAULT 4,
  summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taste_profile TO authenticated;
GRANT ALL ON public.taste_profile TO service_role;

ALTER TABLE public.taste_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own taste profile"
  ON public.taste_profile
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);