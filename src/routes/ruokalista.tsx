import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  ShoppingBasket,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAssistantContext } from "@/components/Assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  usePlan,
  usePlanActions,
  useRecipes,
  useShoppingActions,
  useTasteProfile,
} from "@/lib/store";
import { profileToText } from "@/lib/profile";
import { DEFAULT_SLOTS, MEAL_STATUSES, MEAL_TYPES, WEEKDAYS } from "@/lib/types";
import type { MealEntry, Recipe } from "@/lib/types";
import { shortDate, weekDates } from "@/lib/week";
import { generateWeekPlan } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/ruokalista")({
  head: () => ({
    meta: [
      { title: "Viikon ruokalista – Tilli" },
      {
        name: "description",
        content: "Suunnittele viikon ateriat aterioittain ja anna AI:n ehdottaa koko viikko.",
      },
      { property: "og:title", content: "Viikon ruokalista – Tilli" },
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
  const { data: taste } = useTasteProfile();
  const [wish, setWish] = useState("");
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const todayStr = new Date().toLocaleDateString("sv-SE");

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

  // Paikka, johon tekoäly sijoittaa päivän ruoan (päivällinen tai päivän viimeinen ateria)
  const targetSlot = (date: string): MealEntry | null => {
    const slots = slotsFor(date);
    return slots.find((s) => s.meal_type === "Päivällinen") ?? slots[slots.length - 1] ?? null;
  };

  // Kuinka monessa päivässä generointi korvaisi jo valitun reseptin tai tilanteen
  const occupiedCount = dates.filter((d) => {
    const t = targetSlot(d);
    return !!t && (!!t.recipe_id || !!t.status);
  }).length;

  function requestGenerate() {
    if (!recipes.length) {
      toast.error("Tallenna ensin muutama resepti.");
      return;
    }
    if (occupiedCount > 0) {
      setConfirmOpen(true);
      return;
    }
    void generate("all");
  }

  async function generate(mode: "all" | "empty") {
    setConfirmOpen(false);
    setGenerating(true);
    try {
      const result = await generateWeekPlan({
        data: {
          recipes: recipes.map((r) => ({ id: r.id, title: r.title, tags: r.tags })),
          wish: wish.trim() || undefined,
          profile: profileToText(taste),
        },
      });
      let filled = 0;
      for (const item of result) {
        const date = dates[item.day];
        if (!date) continue;
        const target = targetSlot(date);
        if (mode === "empty" && target && (target.recipe_id || target.status)) continue;
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
        filled++;
      }
      toast.success(
        mode === "empty"
          ? `Täytettiin ${filled} tyhjää päivää.`
          : "Viikon ruokalista luotu.",
      );
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
      <h1 className="mb-4 text-3xl">Ruokalista</h1>

      {/* Viikkovalitsin */}
      <div className="mb-2 flex rounded-full bg-secondary p-1">
        {[
          { label: "Tämä viikko", offset: 0 },
          { label: "Ensi viikko", offset: 1 },
        ].map((tab) => (
          <button
            key={tab.offset}
            type="button"
            onClick={() => setWeekOffset(tab.offset)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition-colors",
              weekOffset === tab.offset
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mb-5 flex items-center justify-between text-sm text-muted-foreground">
        <button
          type="button"
          aria-label="Edellinen viikko"
          onClick={() => setWeekOffset((w) => w - 1)}
          className="rounded-full p-2 hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span>
          {shortDate(dates[0]!)} – {shortDate(dates[6]!)}
        </span>
        <button
          type="button"
          aria-label="Seuraava viikko"
          onClick={() => setWeekOffset((w) => w + 1)}
          className="rounded-full p-2 hover:bg-secondary"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Tekoälykortti */}
      <section className="mb-4 rounded-3xl bg-secondary/70 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <div>
            <h2 className="font-display text-lg leading-tight">Suunnittele tekoälyllä</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tekoäly luo viikon ruokalistan tallentamistasi resepteistä, makuprofiilistasi ja
              toiveistasi.
            </p>
          </div>
        </div>
        <Input
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          placeholder="Esim. nopeaa kasvisruokaa arkeen"
          className="mt-3 bg-card"
        />
        <Button
          className="mt-3 h-11 w-full rounded-[14px]"
          onClick={requestGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generoi ruokalista
        </Button>
      </section>

      {/* Päivät */}
      <ul className="divide-y divide-border/60">
        {dates.map((date, i) => {
          const slots = slotsFor(date);
          const isToday = date === todayStr;
          return (
            <li key={date} className="grid grid-cols-[3.25rem_1fr] gap-3 py-4">
              <div className="pt-1">
                <p
                  className={cn(
                    "text-base font-semibold",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {WEEKDAYS[i]?.slice(0, 2)}
                </p>
                <p className="text-xs text-muted-foreground">{shortDate(date)}</p>
              </div>

              <div className="min-w-0 space-y-2">
                {slots.length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">
                    Ei aterioita tälle päivälle.
                  </p>
                )}

                {slots.map((slot) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    recipe={recipeById(slot.recipe_id)}
                    recipes={recipes}
                    label={`${WEEKDAYS[i]} ${slot.meal_type}: valitse resepti tai tilanne`}
                    onRecipeChange={(v) =>
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
                    onTypeChange={(v) =>
                      setSlot.mutate({
                        id: slot.id,
                        date,
                        meal_type: v,
                        recipe_id: slot.recipe_id,
                        status: slot.status,
                      })
                    }
                    onDelete={() => deleteSlot.mutate(slot.id)}
                  />
                ))}

                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full px-1 py-1 text-sm font-medium text-primary"
                  onClick={() =>
                    addSlot.mutate({
                      date,
                      meal_type:
                        MEAL_TYPES.find((t) => !slots.some((s) => s.meal_type === t)) ??
                        "Välipala",
                      position: slots.length,
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Lisää ateria
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Button variant="outline" className="mt-4 h-11 w-full rounded-[14px]" onClick={addWeekToList}>
        <ShoppingBasket className="mr-2 h-4 w-4" /> Lisää viikon reseptit ostoslistalle
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Korvataanko valitut ateriat?</DialogTitle>
            <DialogDescription>
              Viikolla on jo {occupiedCount} valittua ateriaa tai tilannetta, jotka generointi
              korvaisi. Haluatko täyttää vain tyhjät päivät?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button className="h-11 rounded-[14px]" onClick={() => void generate("empty")}>
              Täytä vain tyhjät
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-[14px]"
              onClick={() => void generate("all")}
            >
              Korvaa myös valitut
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Peruuta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>

function SlotRow({
  slot,
  recipe,
  recipes,
  label,
  onRecipeChange,
  onTypeChange,
  onDelete,
}: {
  slot: MealEntry;
  recipe: Recipe | undefined;
  recipes: Recipe[];
  label: string;
  onRecipeChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onDelete: () => void;
}) {
  const statusLabel = slot.status
    ? (MEAL_STATUSES.find((s) => s.key === slot.status)?.label ?? slot.status)
    : null;
  const loadingRecipe = !!slot.recipe_id && !recipe;
  const title = recipe?.title ?? statusLabel ?? (loadingRecipe ? "…" : "Valitse resepti");
  const empty = !recipe && !statusLabel && !loadingRecipe;
  const value = slot.recipe_id ?? (slot.status ? `${STATUS_PREFIX}${slot.status}` : NONE);
  const types = (MEAL_TYPES as readonly string[]).includes(slot.meal_type)
    ? [...MEAL_TYPES]
    : [slot.meal_type, ...MEAL_TYPES];

  return (
    <div className="relative flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {recipe?.image_url ? (
          <img src={recipe.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {empty ? (
              <Plus className="h-5 w-5 text-muted-foreground/60" />
            ) : (
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground/60" />
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative z-[2] inline-flex items-center gap-0.5 text-xs font-medium text-primary">
          {slot.meal_type}
          <ChevronDown className="h-3 w-3" />
          <select
            aria-label="Aterian tyyppi"
            value={slot.meal_type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <p
          className={cn(
            "truncate text-[15px] font-semibold leading-snug",
            empty && "font-normal text-muted-foreground",
          )}
        >
          {title}
        </p>
      </div>

      <button
        type="button"
        aria-label="Poista ateria"
        onClick={onDelete}
        className="relative z-[2] rounded-full p-2 text-muted-foreground hover:bg-secondary"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Läpinäkyvä valinta koko rivin päällä: avaa laitteen oman valitsimen */}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onRecipeChange(e.target.value)}
        className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0"
      >
        <option value={NONE}>Ei valintaa</option>
        <optgroup label="Tilanne">
          {MEAL_STATUSES.map((s) => (
            <option key={s.key} value={`${STATUS_PREFIX}${s.key}`}>
              {s.label}
            </option>
          ))}
        </optgroup>
        {recipes.length > 0 && (
          <optgroup label="Reseptit">
            {recipes.map((rec) => (
              <option key={rec.id} value={rec.id}>
                {rec.title}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}