import type { Ingredient, ShoppingItem } from "./types";

const KEYWORDS: Record<string, string[]> = {
  kasvikset: [
    "sipuli",
    "valkosipuli",
    "porkkana",
    "tomaatti",
    "kurkku",
    "salaatti",
    "paprika",
    "peruna",
    "bataatti",
    "sitruuna",
    "lime",
    "omena",
    "banaani",
    "marja",
    "mansikka",
    "mustikka",
    "herne",
    "pinaatti",
    "parsakaali",
    "kukkakaali",
    "kaali",
    "sieni",
    "herkkusieni",
    "avokado",
    "chili",
    "inkivääri",
    "persilja",
    "basilika",
    "korianteri",
    "ruohosipuli",
    "kesäkurpitsa",
    "munakoiso",
    "purjo",
    "lanttu",
    "selleri",
    "retiisi",
    "appelsiini",
  ],
  kuivatuotteet: [
    "jauho",
    "sokeri",
    "riisi",
    "pasta",
    "spagetti",
    "makaroni",
    "nuudeli",
    "couscous",
    "bulgur",
    "kaura",
    "hiutale",
    "leipä",
    "korppujauho",
    "leivinjauhe",
    "sooda",
    "hiiva",
    "suola",
    "pippuri",
    "mauste",
    "curry",
    "kanelia",
    "kaneli",
    "kaakao",
    "öljy",
    "etikka",
    "soijakastike",
    "hunaja",
    "siirappi",
    "pähkinä",
    "manteli",
    "siemen",
    "linssi",
    "kikherne",
    "papu",
    "tomaattimurska",
    "tomaattipyre",
    "liemikuutio",
    "fondi",
    "quinoa",
  ],
  maitotuotteet: [
    "maito",
    "kerma",
    "ruokakerma",
    "vispikerma",
    "jogurtti",
    "rahka",
    "juusto",
    "fetajuusto",
    "mozzarella",
    "parmesaani",
    "raejuusto",
    "voi",
    "margariini",
    "kaurajuoma",
    "soijajuoma",
    "kauramaito",
    "creme",
    "smetana",
    "muna",
    "kananmuna",
  ],
  kylmatuotteet: [
    "jauheliha",
    "nauta",
    "sika",
    "kana",
    "broileri",
    "kalkkuna",
    "kala",
    "lohi",
    "seiti",
    "katkarapu",
    "pekoni",
    "makkara",
    "kinkku",
    "tofu",
    "nyhtökaura",
    "härkis",
    "soijasuikale",
    "säilyke",
    "tonnikala",
    "pakaste",
    "hernekeitto",
  ],
};

export function categorize(name: string): string {
  const n = name.toLowerCase();
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => n.includes(w))) return cat;
  }
  return "muut";
}

const UNIT_ALIASES: Record<string, string> = {
  gramma: "g",
  grammaa: "g",
  g: "g",
  kg: "kg",
  kilo: "kg",
  kiloa: "kg",
  dl: "dl",
  l: "l",
  litra: "l",
  litraa: "l",
  ml: "ml",
  rkl: "rkl",
  tl: "tl",
  kpl: "kpl",
  pkt: "pkt",
  prk: "prk",
  tlk: "prk",
  nippu: "nippu",
};

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase().replace(/\./g, "");
  return UNIT_ALIASES[u] ?? u;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Convert to a base unit so g/kg and dl/l/ml can be merged.
const CONVERSIONS: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  dl: { base: "ml", factor: 100 },
  l: { base: "ml", factor: 1000 },
};

export function scaleIngredient(ing: Ingredient, factor: number): Ingredient {
  if (ing.quantity == null) return ing;
  const scaled = ing.quantity * factor;
  return { ...ing, quantity: Math.round(scaled * 100) / 100 };
}

export function formatQuantity(q: number | null | undefined): string {
  if (q == null) return "";
  const rounded = Math.round(q * 100) / 100;
  return String(rounded).replace(".", ",");
}

type Aggregatable = {
  item_name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  recipe_id: string | null;
};

/** Merge ingredients with the same name + compatible unit. */
export function aggregate(items: Aggregatable[]): Aggregatable[] {
  const map = new Map<string, Aggregatable>();
  for (const item of items) {
    const unit = normalizeUnit(item.unit);
    const conv = unit ? CONVERSIONS[unit] : undefined;
    const key = `${normalizeName(item.item_name)}|${conv ? conv.base : (unit ?? "")}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item, unit });
      continue;
    }
    if (existing.quantity == null || item.quantity == null) {
      existing.quantity = existing.quantity ?? item.quantity;
      continue;
    }
    const existingUnit = normalizeUnit(existing.unit);
    const existingConv = existingUnit ? CONVERSIONS[existingUnit] : undefined;
    if (conv && existingConv) {
      const total = existing.quantity * existingConv.factor + item.quantity * conv.factor;
      // present in the larger unit when it gets big
      if (existingConv.base === "g" && total >= 1000) {
        existing.quantity = Math.round((total / 1000) * 100) / 100;
        existing.unit = "kg";
      } else if (existingConv.base === "ml" && total >= 1000) {
        existing.quantity = Math.round((total / 1000) * 100) / 100;
        existing.unit = "l";
      } else {
        existing.quantity = Math.round(total * 100) / 100;
        existing.unit = existingConv.base === "ml" ? "ml" : "g";
      }
    } else {
      existing.quantity = Math.round((existing.quantity + item.quantity) * 100) / 100;
    }
  }
  return [...map.values()];
}

export function ingredientsToItems(
  ingredients: Ingredient[],
  recipeId: string | null,
  factor = 1,
): Aggregatable[] {
  return ingredients
    .filter((i) => i.name?.trim())
    .map((i) => {
      const scaled = scaleIngredient(i, factor);
      return {
        item_name: i.name.trim(),
        quantity: scaled.quantity,
        unit: normalizeUnit(i.unit),
        category: categorize(i.name),
        recipe_id: recipeId,
      };
    });
}

export function groupByCategory(items: ShoppingItem[]): Record<string, ShoppingItem[]> {
  const groups: Record<string, ShoppingItem[]> = {};
  for (const item of items) {
    const key = item.category || "muut";
    (groups[key] ??= []).push(item);
  }
  return groups;
}
