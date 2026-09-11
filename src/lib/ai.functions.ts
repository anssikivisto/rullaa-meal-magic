import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

type ParsedRecipe = {
  title: string;
  servings: number | null;
  prep_time: number | null;
  ingredients: { quantity: number | null; unit: string | null; name: string }[];
  instructions: string[];
  image_url?: string | null;
};

const recipeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    servings: { type: ["number", "null"] },
    prep_time: { type: ["number", "null"], description: "valmistusaika minuutteina" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          name: { type: "string" },
        },
        required: ["quantity", "unit", "name"],
      },
    },
    instructions: { type: "array", items: { type: "string" } },
  },
  required: ["title", "servings", "prep_time", "ingredients", "instructions"],
};

async function callGateway(body: Record<string, unknown>) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI ei ole käytettävissä.");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Liikaa pyyntöjä juuri nyt. Yritä hetken kuluttua.");
    if (res.status === 402) throw new Error("AI-krediitit ovat lopussa. Lisää krediittejä työtilaan.");
    throw new Error(`AI-virhe (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as unknown;
    throw new Error("AI palautti odottamattoman vastauksen.");
  }
}

const PARSE_SYSTEM = `Olet suomenkielinen reseptijäsentäjä. Saat raakatekstiä (esim. Instagram-kuvaus, TikTok-teksti tai verkkosivun sisältö).
Poista emojit, hashtagit, kehotukset seurata tiliä ja muu jutustelu.
Palauta JSON: title (lyhyt suomenkielinen otsikko), servings (annosmäärä numerona tai null),
prep_time (valmistusaika minuutteina tai null), ingredients (jokaisella quantity numerona tai null,
unit kuten g, kg, dl, ml, l, rkl, tl, kpl, pkt, prk tai null, ja name pelkkänä raaka-aineen nimenä).
TÄRKEÄÄ: erottele jokainen raaka-aine kolmeen kenttään. Määrä kuuluu VAIN quantity-kenttään, mittayksikkö VAIN unit-kenttään
ja name-kentässä ei saa olla määrää eikä yksikköä (esim. "14 oz firm tofu" -> quantity 14, unit "oz", name "kiinteä tofu"),
instructions (selkeät vaiheet järjestyksessä, ilman numerointia).
Kirjoita kaikki suomeksi. Älä keksi raaka-aineita joita tekstissä ei ole.`;

export const parseRecipeText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ text: z.string().min(5).max(20000) }).parse(input))
  .handler(async ({ data }): Promise<ParsedRecipe> => {
    const parsed = (await callGateway({
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user", content: data.text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "recipe", strict: true, schema: recipeSchema },
      },
    })) as ParsedRecipe;
    return parsed;
  });

/* -------- URL import: JSON-LD first, AI fallback -------- */

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v["text"] === "string") return v["text"];
    if (typeof v["name"] === "string") return v["name"];
    if (v["itemListElement"]) return textOf(v["itemListElement"]);
  }
  return "";
}

function parseIsoDuration(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  const d = Number(m[1] ?? 0);
  const h = Number(m[2] ?? 0);
  const min = Number(m[3] ?? 0);
  const total = d * 1440 + h * 60 + min;
  return total > 0 ? total : null;
}

const UNIT_MAP: Record<string, string> = {
  g: "g", gram: "g", grams: "g", gramma: "g", grammaa: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  mg: "mg",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml",
  cl: "cl", dl: "dl", desilitra: "dl", desilitraa: "dl",
  l: "l", litre: "l", litres: "l", liter: "l", liters: "l", litra: "l", litraa: "l",
  rkl: "rkl", tbsp: "rkl", tbs: "rkl", tablespoon: "rkl", tablespoons: "rkl", ruokalusikka: "rkl", ruokalusikallista: "rkl",
  tl: "tl", tsp: "tl", teaspoon: "tl", teaspoons: "tl", teelusikka: "tl", teelusikallista: "tl",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  cup: "cup", cups: "cup",
  pint: "pint", pints: "pint", quart: "quart", quarts: "quart",
  kpl: "kpl", pcs: "kpl", piece: "kpl", pieces: "kpl", kappale: "kpl", kappaletta: "kpl",
  pkt: "pkt", paketti: "pkt", pkg: "pkt", package: "pkt",
  prk: "prk", purkki: "prk", tlk: "tlk", tölkki: "tlk", can: "prk", cans: "prk",
  nippu: "nippu", bunch: "nippu", clove: "kynsi", cloves: "kynsi", kynsi: "kynsi",
  pinch: "ripaus", ripaus: "ripaus", slice: "viipale", slices: "viipale",
};

const FRACTIONS: Record<string, number> = {
  "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.333, "⅔": 0.667, "⅛": 0.125,
};

export function splitIngredient(line: string) {
  let cleaned = line.replace(/\s+/g, " ").trim();
  // leading quantity: "1 1/2", "1½", "14", "2,5", "2-3"
  const qm = cleaned.match(
    /^((?:\d+(?:[.,]\d+)?)(?:\s*[-–/]\s*\d+(?:[.,]\d+)?)?\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])\s*/,
  );
  let quantity: number | null = null;
  if (qm) {
    const raw = (qm[1] ?? "").trim();
    let value = 0;
    const fracChar = raw.match(/[½¼¾⅓⅔⅛]/)?.[0];
    const numeric = raw.replace(/[½¼¾⅓⅔⅛]/g, "").trim();
    if (numeric) {
      if (/\d\s*\/\s*\d/.test(numeric)) {
        const [a, b] = numeric.split("/").map((n) => Number(n.replace(",", ".")));
        value = b ? (a ?? 0) / b : 0;
      } else {
        value = Number((numeric.split(/[-–]/)[0] ?? "").replace(",", "."));
      }
    }
    if (fracChar) value += FRACTIONS[fracChar] ?? 0;
    if (Number.isFinite(value) && value > 0) {
      quantity = Math.round(value * 100) / 100;
      cleaned = cleaned.slice(qm[0].length).trim();
    }
  }

  // leading unit word
  let unit: string | null = null;
  const um = cleaned.match(/^([a-zA-ZäöåÄÖÅ.]+)\b\.?\s*/);
  if (um) {
    const candidate = (um[1] ?? "").replace(/\./g, "").toLowerCase();
    const mapped = UNIT_MAP[candidate];
    if (mapped) {
      unit = mapped;
      cleaned = cleaned.slice(um[0].length).trim();
    }
  }
  cleaned = cleaned.replace(/^(of|,|-|–)\s+/i, "").trim();

  return { quantity, unit, name: cleaned || line.trim() };
}

function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findRecipeNode(n);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const isRecipe = Array.isArray(type)
      ? type.includes("Recipe")
      : typeof type === "string" && type === "Recipe";
    if (isRecipe) return obj;
    if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  }
  return null;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function imageFromNode(node: Record<string, unknown>): string | null {
  const img = node["image"];
  const pick = (v: unknown): string | null => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return pick(v[0]);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o["url"] === "string") return o["url"];
    }
    return null;
  };
  return pick(img);
}

function ogImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m?.[1] ?? null;
}

export const parseRecipeUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ url: z.string().url() }).parse(input))
  .handler(async ({ data }): Promise<ParsedRecipe & { source_url: string }> => {
    let html = "";
    try {
      const res = await fetch(data.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RullaaBot/1.0)" },
      });
      if (!res.ok) throw new Error(String(res.status));
      html = await res.text();
    } catch {
      throw new Error("Sivua ei voitu avata. Tarkista osoite tai liitä resepti tekstinä.");
    }

    const scripts = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const s of scripts) {
      try {
        const node = findRecipeNode(JSON.parse((s[1] ?? "").trim()));
        if (!node) continue;
        const ingredients = (Array.isArray(node["recipeIngredient"]) ? node["recipeIngredient"] : [])
          .map((i) => splitIngredient(String(i)))
          .filter((i) => i.name);
        const instructions = textOf(node["recipeInstructions"])
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean);
        if (ingredients.length) {
          const yieldRaw = node["recipeYield"];
          const yieldText = Array.isArray(yieldRaw) ? String(yieldRaw[0]) : String(yieldRaw ?? "");
          const servings = Number(yieldText.match(/\d+/)?.[0] ?? NaN);
          return {
            title: String(node["name"] ?? "Resepti"),
            servings: Number.isFinite(servings) ? servings : null,
            prep_time: parseIsoDuration(node["totalTime"]) ?? parseIsoDuration(node["cookTime"]),
            ingredients,
            instructions,
            image_url: imageFromNode(node) ?? ogImage(html),
            source_url: data.url,
          };
        }
      } catch {
        /* try next block */
      }
    }

    // Fallback: let AI read the page text
    const text = stripHtml(html).slice(0, 12000);
    const parsed = (await callGateway({
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "recipe", strict: true, schema: recipeSchema },
      },
    })) as ParsedRecipe;
    return { ...parsed, image_url: ogImage(html), source_url: data.url };
  });

/* -------- tag suggestions -------- */

export const suggestTags = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string(),
        ingredients: z.array(z.string()).max(60),
        prep_time: z.number().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<string[]> => {
    const result = (await callGateway({
      messages: [
        {
          role: "system",
          content: `Ehdota 3-5 lyhyttä suomenkielistä tagia reseptille. Käytä pieniä kirjaimia ilman risuaitaa.
Suosi näitä kun ne sopivat: arki, juhla, kasvis, vegaani, kala, kana, liha, terveellinen, alle-20min, alle-30min, uuniruoka, keitto, salaatti, pasta, jälkiruoka, gluteeniton, edullinen, pakastettava.
Palauta JSON muodossa {"tags": ["..."]}.`,
        },
        {
          role: "user",
          content: `Otsikko: ${data.title}\nValmistusaika: ${data.prep_time ?? "?"} min\nRaaka-aineet: ${data.ingredients.join(", ")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tags",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { tags: { type: "array", items: { type: "string" } } },
            required: ["tags"],
          },
        },
      },
    })) as { tags: string[] };
    return (result.tags ?? []).slice(0, 5).map((t) => t.replace(/^#/, "").toLowerCase());
  });

/* -------- weekly plan -------- */

export const generateWeekPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        recipes: z
          .array(z.object({ id: z.string(), title: z.string(), tags: z.array(z.string()) }))
          .min(1),
        wish: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ day: number; recipe_id: string }[]> => {
    const result = (await callGateway({
      messages: [
        {
          role: "system",
          content: `Laadit viikon ruokalistan (7 päivää, 0 = maanantai ... 6 = sunnuntai) käyttäjän tallennetuista resepteistä.
Valitse vaihtelevasti, älä toista samaa reseptiä peräkkäisinä päivinä. Arkena (0-4) suosi nopeita arkiruokia, viikonloppuna (5-6) voi olla työläämpi.
Käytä vain annettuja recipe_id -arvoja. Palauta JSON {"plan":[{"day":0,"recipe_id":"..."}, ...]} seitsemälle päivälle.`,
        },
        {
          role: "user",
          content: `Toive: ${data.wish || "ei erityistoivetta"}\nReseptit:\n${data.recipes
            .map((r) => `${r.id} | ${r.title} | ${r.tags.join(", ")}`)
            .join("\n")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "plan",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              plan: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: { day: { type: "number" }, recipe_id: { type: "string" } },
                  required: ["day", "recipe_id"],
                },
              },
            },
            required: ["plan"],
          },
        },
      },
    })) as { plan: { day: number; recipe_id: string }[] };
    const valid = new Set(data.recipes.map((r) => r.id));
    return (result.plan ?? []).filter((p) => valid.has(p.recipe_id) && p.day >= 0 && p.day <= 6);
  });

/* -------- translate + metric conversion -------- */

const recipeInputSchema = z.object({
  title: z.string(),
  servings: z.number().nullable(),
  prep_time: z.number().nullable(),
  ingredients: z.array(
    z.object({
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      name: z.string(),
    }),
  ),
  instructions: z.array(z.string()),
});

export const translateRecipe = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ recipe: recipeInputSchema }).parse(input))
  .handler(async ({ data }): Promise<ParsedRecipe> => {
    const parsed = (await callGateway({
      messages: [
        {
          role: "system",
          content: `Käännä resepti suomeksi ja muunna kaikki mitat metrijärjestelmään.
Muunnokset: 1 cup = 2,4 dl (kuivat aineet muunna grammoiksi kun järkevää), 1 oz = 28 g, 1 lb = 454 g,
1 tbsp = 1 rkl, 1 tsp = 1 tl, fahrenheit -> celsius ((F-32)/1,8, pyöristä lähimpään 5 asteeseen).
Käännä otsikko, raaka-aineet ja vaiheet luontevalle suomelle. Pyöristä määrät järkeviksi.
Palauta sama JSON-rakenne.`,
        },
        { role: "user", content: JSON.stringify(data.recipe) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "recipe", strict: true, schema: recipeSchema },
      },
    })) as ParsedRecipe;
    return parsed;
  });

/* -------- AI chat recipe editor -------- */

export const chatEditRecipe = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        recipe: recipeInputSchema,
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ reply: string; recipe: ParsedRecipe }> => {
    const result = (await callGateway({
      messages: [
        {
          role: "system",
          content: `Olet suomenkielinen kokkiapuri. Muokkaat annettua reseptiä käyttäjän pyyntöjen mukaan
(esim. vegaaniseksi, korvaa raaka-aine, skaalaa annosmäärä, kevennä).
Palauta JSON: reply (lyhyt suomenkielinen selitys mitä muutit, max 2 lausetta) ja
recipe (koko päivitetty resepti samassa rakenteessa, suomeksi ja metrimitoin).
Jos käyttäjä vain kysyy jotain, vastaa reply-kentässä ja palauta resepti muuttumattomana.
Anna muunnelmalle kuvaava otsikko jos ruokalaji muuttuu olennaisesti.`,
        },
        { role: "user", content: `Nykyinen resepti:\n${JSON.stringify(data.recipe)}` },
        ...data.messages,
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "chat_edit",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { reply: { type: "string" }, recipe: recipeSchema },
            required: ["reply", "recipe"],
          },
        },
      },
    })) as { reply: string; recipe: ParsedRecipe };
    return result;
  });

/* -------- AI recipe generator -------- */

export const generateRecipe = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ prompt: z.string().min(3).max(600) }).parse(input),
  )
  .handler(async ({ data }): Promise<ParsedRecipe> => {
    const parsed = (await callGateway({
      messages: [
        {
          role: "system",
          content: `Luot uuden suomenkielisen reseptin käyttäjän toiveen perusteella.
Käytä metrimittoja (g, dl, rkl, tl, kpl). Anna selkeä otsikko, annosmäärä, valmistusaika minuutteina,
raaka-aineet ja vaiheet. Pidä resepti realistisena ja suomalaisesta kaupasta saatavilla aineksilla.`,
        },
        { role: "user", content: data.prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "recipe", strict: true, schema: recipeSchema },
      },
    })) as ParsedRecipe;
    return parsed;
  });

/* -------- web recipe search -------- */

export type WebResult = { title: string; url: string; snippet: string };

function decodeEntities(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export const searchWebRecipes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(2).max(200) }).parse(input))
  .handler(async ({ data }): Promise<WebResult[]> => {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; RullaaBot/1.0)",
      },
      body: new URLSearchParams({ q: `${data.query} resepti` }).toString(),
    });
    if (!res.ok) throw new Error("Haku ei juuri nyt onnistu. Yritä hetken kuluttua.");
    const html = await res.text();
    const results: WebResult[] = [];
    const re =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>)?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && results.length < 12) {
      let url = m[1] ?? "";
      const uddg = url.match(/uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]!);
      if (!/^https?:\/\//.test(url)) continue;
      results.push({
        title: decodeEntities(m[2] ?? ""),
        url,
        snippet: decodeEntities(m[3] ?? "").slice(0, 200),
      });
    }
    return results;
  });

/* -------- general context-aware assistant -------- */

export const assistantChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        context_label: z.string().max(60),
        context_data: z.string().max(12000),
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .min(1)
          .max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ reply: string }> => {
    const result = (await callGateway({
      messages: [
        {
          role: "system",
          content: `Olet Rullaa-sovelluksen suomenkielinen kokkiapuri. Vastaat lyhyesti ja käytännöllisesti suomeksi.
Käytössäsi on käyttäjän nykyisen näkymän tiedot (${data.context_label}). Hyödynnä niitä vastauksissasi.
Palauta JSON {"reply":"..."} jossa vastaus on selkeä ja korkeintaan muutama lause tai lyhyt lista.`,
        },
        { role: "user", content: `Näkymän tiedot:\n${data.context_data}` },
        ...data.messages,
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "assistant",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { reply: { type: "string" } },
            required: ["reply"],
          },
        },
      },
    })) as { reply: string };
    return result;
  });
