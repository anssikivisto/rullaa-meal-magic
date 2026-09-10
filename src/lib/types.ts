export type Ingredient = {
  quantity: number | null;
  unit: string | null;
  name: string;
};

export type Recipe = {
  id: string;
  title: string;
  source_url: string | null;
  prep_time: number | null;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  created_at: string;
};

export type MealEntry = {
  id: string;
  date: string; // yyyy-mm-dd
  recipe_id: string | null;
  meal_type: string;
};

export type ShoppingItem = {
  id: string;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  checked: boolean;
  recipe_id: string | null;
  created_at: string;
};

export const CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: "kasvikset", label: "Kasvikset & Hedelmät", emoji: "🥬" },
  { key: "kuivatuotteet", label: "Kuivatuotteet & Leivonta", emoji: "🍞" },
  { key: "maitotuotteet", label: "Maitotuotteet & Korvikkeet", emoji: "🥛" },
  { key: "kylmatuotteet", label: "Kylmätuotteet & Säilykkeet", emoji: "🥩" },
  { key: "muut", label: "Muut / Yleiset", emoji: "🛒" },
];

export const WEEKDAYS = [
  "Maanantai",
  "Tiistai",
  "Keskiviikko",
  "Torstai",
  "Perjantai",
  "Lauantai",
  "Sunnuntai",
];
