# Rullaa: Effortless Meal Planning

Create a new project with Supabase enabled.

Build a modern, mobile-first Progressive Web App (PWA) called "Rullaa" (in Finnish UI language).



### CORE PURPOSE

"Rullaa" is a minimalist, all-in-one meal planning and grocery shopping assistant designed to make everyday home cooking effortlessly smooth.



Key Capabilities:

1. Save recipes via Web URL, Instagram Reel caption/raw text parsing, or manual entry.

2. Auto-tag recipes using AI suggestions (e.g., #arki, #kasvis, #terveellinen, #alle-20min).

3. Plan weekly meals using an AI Meal Planner.

4. Auto-generate smart, aggregated grocery lists grouped by store sections.



---



### 1. USER AUTHENTICATION & DATABASE (Supabase Integration)

- Set up Supabase Authentication (Google Login + Email/Magic Link).

- Enable a "Guest Mode" using local storage, allowing users to try the app before signing up (migrating local data to Supabase upon registration).

- Set up a clean PostgreSQL schema in Supabase with tables for:

  - `recipes` (id, user_id, title, source_url, prep_time, servings, ingredients [JSON], instructions [Array], tags [Array], created_at)

  - `meal_plan` (id, user_id, date/day_of_week, recipe_id, meal_type)

  - `shopping_list` (id, user_id, item_name, quantity, unit, category, checked, recipe_id)



---



### 2. DUAL-MODE RECIPE IMPORT & MANAGEMENT

- **Import Modal with Two Tabs:**

  1. **"Lue verkko-osoitteesta" (URL Import):** Input field for standard recipe website link. Extract structure using JSON-LD metadata (`schema.org/Recipe`) as primary source, with fallback parser.

  2. **"Liitä kuvaus / Instagram-teksti" (Text & Instagram Parser):** Text area where users can paste raw Instagram Reel captions, TikTok descriptions, or unstructured text. Use an AI parser system prompt to clean up emojis/hashtags/chitchat and extract Title, Servings, Ingredients (quantities + units), and Step-by-step Instructions.

- **Editable Preview Modal:** Show extracted details in a clean form for user confirmation/editing before saving.

- **Manual Recipe Builder:** Option to create recipes from scratch.

- **Serving Scaler:** A dynamic stepper/slider scaling ingredient quantities based on portion size (e.g., 2, 4, 6 persons).

- **Tagging & Filtering System:**

  - Color-coded tag chips (Diet, Occasion, Valmistusaika).

  - **AI Tag Suggestion:** Analyze title and ingredients to automatically suggest 3–5 relevant tags upon saving.

  - Multi-tag search filter.



---



### 3. AI MEAL PLANNER

- Weekly calendar view (Maanantai – Sunnuntai).

- **"Generoi viikon ruokalista" Button:** Uses AI logic to suggest a meal plan based on saved recipes and selected tag constraints (e.g., "Nopea kasvisruoka arkeen").

- Drag-and-drop or simple selector to assign recipes to specific days.



---



### 4. DYNAMIC SHOPPING LIST

- **One-Click Add:** Add selected recipes or whole weekly meal plans directly to the shopping list.

- **Smart Aggregation:** Group identical ingredients (e.g., combining 2 onions from Recipe A + 1 onion from Recipe B into "3 kpl sipulia").

- **Automatic Category Grouping:** Categorize items into Finnish supermarket sections:

  - 🥬 *Kasvikset & Hedelmät*

  - 🍞 *Kuivatuotteet & Leivonta*

  - 🥛 *Maitotuotteet & Korvikkeet*

  - 🥩 *Kylmätuotteet & Säilykkeet*

  - 🛒 *Muut / Yleiset*

- **Offline & Interaction:** Interactive checkboxes to mark items off while shopping, preserving state locally.



---



### 5. UI/UX DESIGN & MOBILE OPTIMIZATION

- Clean, warm, minimalist UI named **Rullaa**.

- Display a subtle icon next to "Rullaa" in the top bar.

- Tabbed bottom navigation for mobile: [Reseptit] | [Ruokalista] | [Ostoslista] | [Tili].

- **Cook Mode (Kokkaustila):** Clean, uncluttered view for individual recipes with large text and stay-awake screen to

ggle so it remains readable on a mobile device while cooking.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2d697e07-5fd0-4958-8cf2-869dc6a84051).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
