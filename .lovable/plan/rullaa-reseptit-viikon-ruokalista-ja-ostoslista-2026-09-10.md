# Rullaa — reseptit, viikon ruokalista ja ostoslista

A Finnish-language, mobile-first meal planning app. Bottom tabs: Reseptit, Ruokalista, Ostoslista, Tili.

## Scope of the first build

1. **Design + shell** — warm minimalist look (soft cream background, herb-green accent, rounded cards), Rullaa logo mark in the top bar, bottom tab bar, installable on a phone home screen.
2. **Recipes** — list with search and tag filters, recipe detail with serving scaler (2/4/6...) and Cook Mode (large text, screen stays awake).
3. **Import** — modal with two tabs: paste a web address, or paste an Instagram/TikTok caption. Both produce an editable preview form before saving. Plus a manual recipe builder.
4. **AI tags** — on save, 3–5 Finnish tags suggested automatically (#arki, #kasvis, #alle-20min...), user can accept/remove.
5. **Weekly plan** — Monday–Sunday view, assign saved recipes per day/meal, plus a "Generoi viikon ruokalista" button that fills the week from saved recipes with optional tag constraints.
6. **Shopping list** — add one recipe or the whole week, quantities of identical ingredients merged, items grouped into Finnish store sections, tick-off checkboxes that persist.
7. **Accounts** — Google sign-in and email magic link. Guest mode stores everything on the device; on sign-up the local recipes, plan and list are moved into the account.

## How it works technically

- **Backend:** Lovable Cloud (database + auth + server functions).
- **Tables:** `recipes` (title, source_url, prep_time, servings, ingredients JSONB, instructions text[], tags text[]), `meal_plan` (date, meal_type, recipe_id), `shopping_list` (item_name, quantity, unit, category, checked, recipe_id). Row-level security scoped to `auth.uid()`, explicit grants per table.
- **Guest mode:** same data shapes in localStorage behind a storage adapter, so screens work identically signed-in or not; a one-shot migration server function uploads local data after first sign-in.
- **URL import:** server function fetches the page, reads `schema.org/Recipe` JSON-LD first, falls back to microdata/heuristics, then an AI cleanup pass for ingredient quantity/unit splitting.
- **Text/Instagram import:** server function sends the raw caption to Lovable AI with a strict Finnish extraction schema (title, servings, ingredients with määrä/yksikkö/aine, steps), stripping emojis and hashtags.
- **AI tags + planner + category assignment:** structured-output AI calls from server functions; ingredient categories fall back to a Finnish keyword table when AI is unavailable.
- **Aggregation:** ingredients normalized (lowercased base name, unit converted where compatible) and summed; incompatible units listed separately.
- **PWA:** manifest + icons for home-screen install; shopping list state cached locally so ticking works with a weak signal. Cook Mode uses the Wake Lock API.
- **Routes:** `/` recipes, `/resepti/$id`, `/ruokalista`, `/ostoslista`, `/tili`, each with its own Finnish page title/description.

## Build order

1. Enable Cloud, database schema + policies, design system, app shell with bottom tabs.
2. Recipes list/detail, manual builder, serving scaler, Cook Mode.
3. Import modal (URL + text) with editable preview, AI tags.
4. Weekly plan + AI generation.
5. Shopping list with aggregation and categories.
6. Auth (Google + magic link), guest mode and migration, PWA install.

## Notes

- Sample recipes are seeded so the app is not empty on first open; they are clearly ordinary Finnish home recipes and can be deleted.
- Instagram captions vary a lot; the parser shows its result for editing rather than saving blindly.
