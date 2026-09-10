import type { MealEntry, Recipe, ShoppingItem } from "./types";

const KEYS = {
  recipes: "rullaa.recipes",
  plan: "rullaa.plan",
  list: "rullaa.list",
} as const;

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const localStore = {
  recipes: () => read<Recipe>(KEYS.recipes),
  setRecipes: (r: Recipe[]) => write(KEYS.recipes, r),
  plan: () => read<MealEntry>(KEYS.plan),
  setPlan: (p: MealEntry[]) => write(KEYS.plan, p),
  list: () => read<ShoppingItem>(KEYS.list),
  setList: (l: ShoppingItem[]) => write(KEYS.list, l),
  clear: () => {
    if (typeof window === "undefined") return;
    Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
  },
  isEmpty: () =>
    read<Recipe>(KEYS.recipes).length === 0 &&
    read<MealEntry>(KEYS.plan).length === 0 &&
    read<ShoppingItem>(KEYS.list).length === 0,
};

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
