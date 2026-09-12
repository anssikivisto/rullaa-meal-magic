import { useState } from "react";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagChip } from "./TagChip";
import type { Ingredient, Recipe } from "@/lib/types";
import { suggestTags } from "@/lib/ai.functions";
import { toast } from "sonner";

export type DraftRecipe = {
  id?: string;
  title: string;
  image_url?: string | null;
  source_url: string | null;
  prep_time: number | null;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  notes?: string | null;
};

export function emptyDraft(): DraftRecipe {
  return {
    title: "",
    image_url: null,
    source_url: null,
    prep_time: null,
    servings: 4,
    ingredients: [{ quantity: null, unit: null, name: "" }],
    instructions: [""],
    tags: [],
    notes: null,
  };
}

export function recipeToDraft(r: Recipe): DraftRecipe {
  return {
    id: r.id,
    title: r.title,
    image_url: r.image_url,
    source_url: r.source_url,
    prep_time: r.prep_time,
    servings: r.servings,
    ingredients: r.ingredients.length ? r.ingredients : [{ quantity: null, unit: null, name: "" }],
    instructions: r.instructions.length ? r.instructions : [""],
    tags: r.tags,
    notes: r.notes,
  };
}

export function RecipeEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  draft: DraftRecipe;
  onChange: (d: DraftRecipe) => void;
  onSave: () => void;
  onCancel?: () => void;
  saving?: boolean;
}) {
  const [tagInput, setTagInput] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);

  const set = (patch: Partial<DraftRecipe>) => onChange({ ...draft, ...patch });

  const updateIngredient = (i: number, patch: Partial<Ingredient>) => {
    const next = draft.ingredients.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing));
    set({ ingredients: next });
  };

  async function handleSuggest() {
    if (!draft.title.trim()) {
      toast.error("Anna reseptille ensin nimi.");
      return;
    }
    setSuggesting(true);
    try {
      const tags = await suggestTags({
        data: {
          title: draft.title,
          ingredients: draft.ingredients.map((i) => i.name).filter(Boolean),
          prep_time: draft.prep_time,
        },
      });
      const fresh = tags.filter((t) => !draft.tags.includes(t));
      setSuggested(fresh);
      toast.success(
        fresh.length ? "Napauta ehdotuksia lisätäksesi ne." : "Ei uusia ehdotuksia.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tagien ehdottaminen epäonnistui.");
    } finally {
      setSuggesting(false);
    }
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!t) return;
    set({ tags: [...new Set([...draft.tags, t])] });
    setTagInput("");
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Nimi</Label>
        <Input
          id="title"
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Esim. Uunilohi ja perunat"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="image">Kuvan osoite (valinnainen)</Label>
        <Input
          id="image"
          value={draft.image_url ?? ""}
          onChange={(e) => set({ image_url: e.target.value || null })}
          placeholder="https://..."
          inputMode="url"
        />
        {draft.image_url ? (
          <img
            src={draft.image_url}
            alt={draft.title || "Reseptin kuva"}
            className="h-32 w-full rounded-xl object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="servings">Annokset</Label>
          <Input
            id="servings"
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.servings}
            onChange={(e) => set({ servings: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prep">Valmistusaika (min)</Label>
          <Input
            id="prep"
            type="number"
            inputMode="numeric"
            value={draft.prep_time ?? ""}
            onChange={(e) => set({ prep_time: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Raaka-aineet</Label>
        {draft.ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2">
            <Input
              className="w-16"
              inputMode="decimal"
              placeholder="Määrä"
              value={ing.quantity ?? ""}
              onChange={(e) =>
                updateIngredient(i, {
                  quantity: e.target.value ? Number(e.target.value.replace(",", ".")) : null,
                })
              }
            />
            <Input
              className="w-16"
              placeholder="yks."
              value={ing.unit ?? ""}
              onChange={(e) => updateIngredient(i, { unit: e.target.value || null })}
            />
            <Input
              className="flex-1"
              placeholder="raaka-aine"
              value={ing.name}
              onChange={(e) => updateIngredient(i, { name: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Poista rivi"
              onClick={() => set({ ingredients: draft.ingredients.filter((_, idx) => idx !== i) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set({ ingredients: [...draft.ingredients, { quantity: null, unit: null, name: "" }] })
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Lisää raaka-aine
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Valmistusvaiheet</Label>
        {draft.instructions.map((step, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2.5 w-5 shrink-0 text-sm text-muted-foreground">{i + 1}.</span>
            <Textarea
              rows={2}
              value={step}
              onChange={(e) =>
                set({
                  instructions: draft.instructions.map((s, idx) =>
                    idx === i ? e.target.value : s,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Poista vaihe"
              onClick={() => set({ instructions: draft.instructions.filter((_, idx) => idx !== i) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => set({ instructions: [...draft.instructions, ""] })}
        >
          <Plus className="mr-1 h-4 w-4" /> Lisää vaihe
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tagit</Label>
          <Button type="button" variant="ghost" size="sm" onClick={handleSuggest} disabled={suggesting}>
            {suggesting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            Ehdota tagit
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {draft.tags.map((t) => (
            <span key={t} className="relative">
              <TagChip tag={t} className="pr-6" />
              <button
                type="button"
                aria-label={`Poista tagi ${t}`}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-current opacity-60"
                onClick={() => set({ tags: draft.tags.filter((x) => x !== t) })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        {suggested.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Ehdotukset – napauta lisätäksesi</p>
            <div className="flex flex-wrap gap-1.5">
              {suggested.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    set({ tags: [...new Set([...draft.tags, t])] });
                    setSuggested((prev) => prev.filter((x) => x !== t));
                  }}
                  className="rounded-full border border-dashed border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={tagInput}
            placeholder="Lisää tagi"
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Lisää
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Omat muistiinpanot</Label>
        <Textarea
          id="notes"
          rows={3}
          value={draft.notes ?? ""}
          onChange={(e) => set({ notes: e.target.value || null })}
          placeholder="Esim. uunilämpö 200 °C, lapset tykkäävät ilman chiliä"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={onSave} disabled={saving} className="flex-1">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tallenna resepti
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Peruuta
          </Button>
        )}
      </div>
    </div>
  );
}
