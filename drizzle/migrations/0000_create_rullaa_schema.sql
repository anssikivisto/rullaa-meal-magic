CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  prep_time INTEGER,
  servings INTEGER NOT NULL DEFAULT 4,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recipes" ON public.recipes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX recipes_user_idx ON public.recipes(user_id, created_at DESC);

CREATE TABLE public.meal_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL DEFAULT 'paaruoka',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan TO authenticated;
GRANT ALL ON public.meal_plan TO service_role;
ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meal plan" ON public.meal_plan FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX meal_plan_user_date_idx ON public.meal_plan(user_id, date);

CREATE TABLE public.shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  category TEXT NOT NULL DEFAULT 'muut',
  checked BOOLEAN NOT NULL DEFAULT false,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list TO authenticated;
GRANT ALL ON public.shopping_list TO service_role;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shopping list" ON public.shopping_list FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX shopping_list_user_idx ON public.shopping_list(user_id, created_at);