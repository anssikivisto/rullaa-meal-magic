ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS meal_plan_user_date_idx ON public.meal_plan (user_id, date);