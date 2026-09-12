import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Minus, Plus, ShoppingBasket, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAssistantContext } from "@/components/Assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlan, usePlanActions, useRecipes, useShoppingActions } from "@/lib/store";
import { DEFAULT_SLOTS, MEAL_STATUSES, MEAL_TYPES, WEEKDAYS } from "@/lib/types";
import type { MealEntry, Recipe } from "@/lib/types";
import { shortDate, weekDates } from "@/lib/week";
import { generateWeekPlan } from "@/lib/ai.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/ruokalista")({
  head: () => ({
    meta: [
      { title: "Viikon ruokalista – Rullaa" },
      {
        name: "description",
        content: "Suunnittele viikon ateriat aterioittain ja anna AI:n ehdottaa koko viikko.",
      },
      { property: "og:title", content: "Viikon ruokalista – Rullaa" },
      { property: "og:description", content: "Suunnittele viikon ateriat helposti." },
    ],
  }),
  component: Ruokalista,
});

const NONE = "__none__";
const STATUS_PREFIX = "status:";

function Ruokalista() {
  const [weekOffset, setWeekOffset] = useState(0);
  const dates = weekDates(weekOffset);
  const { data: recipes = [] } = useRecipes();
  const { data: plan = [] } = usePlan();
  const { setSlot, addSlot, deleteSlot, ensureWeek } = usePlanActions();
  const { addRecipes } = useShoppingActions();
  const [wish, setWish] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    ensureWeek.mutate({ dates, defaults: DEFAULT_SLOTS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  const slotsFor = (date: string): MealEntry[] =>
    plan
      .filter((p) => p.date === date)
      .sort((a, b) => a.position - b.position || a.meal_type.localeCompare(b.meal_type));

  const recipeById = (id: string | null) => recipes.find((r) => r.id === id);

  useAssistantContext({
    label: "Viikon ruokalista",
    data: dates.map((date, i) => ({
      paiva: WEEKDAYS[i],
      pvm: date,
      ateriat: slotsFor(date).map((s) => ({
        tyyppi: s.meal_type,
        resepti: recipeById(s.recipe_id)?.title ?? null,
        tila: s.status,
      })),
    })),
  });

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
        if (!date) continue;
        const slots = slotsFor(date);
        const target =
          slots.find((s) => s.meal_type === "Päivällinen") ?? slots[slots.length - 1] ?? null;
        if (target) {
          await setSlot.mutateAsync({
            id: target.id,
            date,
            meal_type: target.meal_type,
            recipe_id: item.recipe_id,
            status: null,
          });
        } else {
          await addSlot.mutateAsync({
            date,
            meal_type: "Päivällinen",
            recipe_id: item.recipe_id,
            position: 0,
          });
        }
      }
      toast.success("Viikon ruokalista luotu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ruokalistan luonti epäonnistui.");
    } finally {
      setGenerating(false);
    }
  }

  async function addWeekToList() {
    const chosen: Recipe[] = dates
      .flatMap((d) => slotsFor(d))
      .map((s) => recipeById(s.recipe_id))
      .filter((r): r is Recipe => !!r);
    if (!chosen.length) {
      toast.error("Viikolle ei ole vielä valittu reseptejä.");
      return;
    }
    await addRecipes.mutateAsync(chosen.map((recipe) => ({ recipe })));
    toast.success("Viikon reseptien ainekset lisätty ostoslistalle.");
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

      <ul className="mt-4 space-y-3">
        {dates.map((date, i) => {
          const slots = slotsFor(date);
          return (
            <li key={date} className="card-soft space-y-3 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg">{WEEKDAYS[i]}</span>
                <span className="text-xs text-muted-foreground">{shortDate(date)}</span>
              </div>

              {slots.length === 0 && (
                <p className="text-sm text-muted-foreground">Ei aterioita tälle päivälle.</p>
              )}

              {slots.map((slot) => {
                const value = slot.recipe_id
                  ? slot.recipe_id
                  : slot.status
                    ? `${STATUS_PREFIX}${slot.status}`
                    : NONE;
                return (
                  <div key={slot.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Select
                        value={slot.meal_type}
                        onValueChange={(v) =>
                          setSlot.mutate({
                            id: slot.id,
                            date,
                            meal_type: v,
                            recipe_id: slot.recipe_id,
                            status: slot.status,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEAL_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Poista ateria"
                        onClick={() => deleteSlot.mutate(slot.id)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>

                    <Select
                      value={value}
                      onValueChange={(v) =>
                        setSlot.mutate({
                          id: slot.id,
                          date,
                          meal_type: slot.meal_type,
                          recipe_id: v === NONE || v.startsWith(STATUS_PREFIX) ? null : v,
                          status: v.startsWith(STATUS_PREFIX)
                            ? v.slice(STATUS_PREFIX.length)
                            : null,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Valitse resepti tai tilanne" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Ei valintaa</SelectItem>
                        {MEAL_STATUSES.map((s) => (
                          <SelectItem key={s.key} value={`${STATUS_PREFIX}${s.key}`}>
                            {s.label}
                          </SelectItem>
                        ))}
                        {recipes.map((rec) => (
                          <SelectItem key={rec.id} value={rec.id}>
                            {rec.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  addSlot.mutate({
                    date,
                    meal_type:
                      MEAL_TYPES.find((t) => !slots.some((s) => s.meal_type === t)) ?? "Välipala",
                    position: slots.length,
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Lisää ateria
              </Button>
            </li>
          );
        })}
      </ul>

      <Button variant="outline" className="mt-4 w-full" onClick={addWeekToList}>
        <ShoppingBasket className="mr-2 h-4 w-4" /> Lisää viikon reseptit ostoslistalle
      </Button>
    </AppShell>
  );
}
