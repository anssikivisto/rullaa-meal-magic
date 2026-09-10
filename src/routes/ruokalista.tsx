import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShoppingBasket, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlan, useRecipes, useSetPlanEntry, useShoppingActions } from "@/lib/store";
import { WEEKDAYS } from "@/lib/types";
import { shortDate, weekDates } from "@/lib/week";
import { generateWeekPlan } from "@/lib/ai.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/ruokalista")({
  head: () => ({
    meta: [
      { title: "Viikon ruokalista – Rullaa" },
      {
        name: "description",
        content: "Suunnittele viikon ruoat maanantaista sunnuntaihin ja anna AI:n ehdottaa lista.",
      },
      { property: "og:title", content: "Viikon ruokalista – Rullaa" },
      { property: "og:description", content: "Suunnittele viikon ateriat helposti." },
    ],
  }),
  component: Ruokalista,
});

const NONE = "__none__";

function Ruokalista() {
  const [weekOffset, setWeekOffset] = useState(0);
  const dates = weekDates(weekOffset);
  const { data: recipes = [] } = useRecipes();
  const { data: plan = [] } = usePlan();
  const setEntry = useSetPlanEntry();
  const { addRecipes } = useShoppingActions();
  const [wish, setWish] = useState("");
  const [generating, setGenerating] = useState(false);

  const recipeFor = (date: string) => {
    const entry = plan.find((p) => p.date === date);
    return entry?.recipe_id ? recipes.find((r) => r.id === entry.recipe_id) : undefined;
  };

  async function generate() {
    if (!recipes.length) {
      toast.error("Tallenna ensin muutama resepti.");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateWeekPlan({
        data: {
          recipes: recipes.map((r) => ({ id: r.id, title: r.title, tags: r.tags })),
          wish: wish.trim() || undefined,
        },
      });
      for (const item of result) {
        const date = dates[item.day];
        if (date) await setEntry.mutateAsync({ date, recipe_id: item.recipe_id });
      }
      toast.success("Viikon ruokalista luotu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ruokalistan luonti epäonnistui.");
    } finally {
      setGenerating(false);
    }
  }

  async function addWeekToList() {
    const chosen = dates.map(recipeFor).filter(Boolean);
    if (!chosen.length) {
      toast.error("Viikolle ei ole vielä valittu ruokia.");
      return;
    }
    await addRecipes.mutateAsync(chosen.map((r) => ({ recipe: r! })));
    toast.success("Koko viikko lisätty ostoslistalle.");
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl">Viikon ruokalista</h1>

      <div className="mt-3 flex items-center justify-between text-sm">
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
          ← Edellinen
        </Button>
        <span className="text-muted-foreground">
          {shortDate(dates[0]!)} – {shortDate(dates[6]!)}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
          Seuraava →
        </Button>
      </div>

      <div className="card-soft mt-4 space-y-3 px-4 py-4">
        <p className="text-sm text-muted-foreground">
          Kerro millaista viikkoa toivot – esimerkiksi &quot;nopeaa kasvisruokaa arkeen&quot;.
        </p>
        <Input
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          placeholder="Nopeaa kasvisruokaa arkeen"
        />
        <Button className="w-full" onClick={generate} disabled={generating}>
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generoi viikon ruokalista
        </Button>
      </div>

      <ul className="mt-4 space-y-2">
        {dates.map((date, i) => {
          const r = recipeFor(date);
          return (
            <li key={date} className="card-soft px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg">{WEEKDAYS[i]}</span>
                <span className="text-xs text-muted-foreground">{shortDate(date)}</span>
              </div>
              <Select
                value={r?.id ?? NONE}
                onValueChange={(v) =>
                  setEntry.mutate({ date, recipe_id: v === NONE ? null : v })
                }
              >
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder="Valitse resepti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ei valintaa</SelectItem>
                  {recipes.map((rec) => (
                    <SelectItem key={rec.id} value={rec.id}>
                      {rec.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>

      <Button variant="outline" className="mt-4 w-full" onClick={addWeekToList}>
        <ShoppingBasket className="mr-2 h-4 w-4" /> Lisää koko viikko ostoslistalle
      </Button>
    </AppShell>
  );
}
