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
  image_url: string | null;
  notes: string | null;
  created_at: string;
};

export type MealEntry = {
  id: string;
  date: string; // yyyy-mm-dd
  recipe_id: string | null;
  meal_type: string;
  status: string | null;
  position: number;
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

export type TasteProfile = {
  tags: string[];
  dislikes: string | null;
  default_servings: number;
  summary: string | null;
  updated_at: string | null;
};

export const TASTE_TAGS = [
  "kasvispainotteinen",
  "sekasyöjä",
  "vegaani",
  "kala",
  "kana",
  "terveellistä",
  "nopeaa (alle 30 min)",
  "uuniruoat",
  "budjetti",
  "mausteinen",
  "lapsiystävällinen",
  "gluteeniton",
  "maidoton",
  "meal prep",
] as const;

export const MEAL_TYPES = ["Aamiainen", "Lounas", "Päivällinen", "Välipala"] as const;

export const DEFAULT_SLOTS = ["Lounas", "Päivällinen"] as const;

export const MEAL_STATUSES = [
  { key: "toissa", label: "Töissä/Koulussa" },
  { key: "muualla", label: "Syödään muualla" },
  { key: "tahteet", label: "Tähteet" },
] as const;

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
