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
unit kuten g, dl, rkl, tl, kpl tai null, ja name pelkkänä raaka-aineen nimenä),
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

function splitIngredient(line: string) {
  const cleaned = line.replace(/\s+/g, " ").trim();
  const m = cleaned.match(
    /^([\d]+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|½|¼|¾)\s*([a-zA-ZäöåÄÖÅ]{1,5}\.?)?\s+(.+)$/,
  );
  if (!m) return { quantity: null, unit: null, name: cleaned };
  const rawQ = (m[1] ?? "").replace("½", "0.5").replace("¼", "0.25").replace("¾", "0.75");
  const q = Number(rawQ.split(/[-–]/)[0]!.replace(",", "."));
  const units = ["g", "kg", "dl", "l", "ml", "rkl", "tl", "kpl", "pkt", "prk", "tlk", "nippu"];
  const unitCandidate = (m[2] ?? "").replace(".", "").toLowerCase();
  if (unitCandidate && units.includes(unitCandidate)) {
    return { quantity: Number.isFinite(q) ? q : null, unit: unitCandidate, name: (m[3] ?? "").trim() };
  }
  return {
    quantity: Number.isFinite(q) ? q : null,
    unit: null,
    name: `${m[2] ? m[2] + " " : ""}${m[3] ?? ""}`.trim(),
  };
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
    return { ...parsed, source_url: data.url };
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
