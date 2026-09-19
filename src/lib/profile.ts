import type { TasteProfile } from "./types";

/** Short Finnish text description of the user's taste profile for AI prompts. */
export function profileToText(p?: TasteProfile | null): string | undefined {
  if (!p) return undefined;
  const parts: string[] = [];
  if (p.summary) parts.push(p.summary);
  if (p.tags?.length) parts.push(`Tagit: ${p.tags.join(", ")}`);
  if (p.dislikes) parts.push(`Välttää: ${p.dislikes}`);
  if (p.default_servings) parts.push(`Oletusannosmäärä: ${p.default_servings}`);
  const text = parts.join(". ").slice(0, 2000);
  return text || undefined;
}
