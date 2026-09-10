import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChefHat, Clock, ExternalLink, Minus, Pencil, Plus, ShoppingBasket, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TagChip } from "@/components/TagChip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecipeEditor, recipeToDraft, type DraftRecipe } from "@/components/RecipeEditor";
import { useDeleteRecipe, useRecipes, useSaveRecipe, useShoppingActions } from "@/lib/store";
import { formatQuantity, scaleIngredient } from "@/lib/categorize";
import { toast } from "sonner";

export const Route = createFileRoute("/resepti/$id")({
  head: () => ({
    meta: [
      { title: "Resepti – Rullaa" },
      { name: "description", content: "Katso resepti, skaalaa annokset ja siirry kokkaustilaan." },
      { property: "og:title", content: "Resepti – Rullaa" },
      { property: "og:description", content: "Resepti, annosskaalaus ja kokkaustila." },
    ],
  }),
  component: ReseptiSivu,
});

function useWakeLock(active: boolean) {
  const ref = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    async function run() {
      if (!active || !nav.wakeLock) return;
      try {
        const lock = await nav.wakeLock.request("screen");
        if (cancelled) void lock.release();
        else ref.current = lock;
      } catch {
        /* ignore */
      }
    }
    void run();
    return () => {
      cancelled = true;
      void ref.current?.release().catch(() => {});
      ref.current = null;
    };
  }, [active]);
}

function ReseptiSivu() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: recipes = [], isLoading } = useRecipes();
  const recipe = recipes.find((r) => r.id === id);
  const [servings, setServings] = useState<number | null>(null);
  const [cookMode, setCookMode] = useState(false);
  const [editDraft, setEditDraft] = useState<DraftRecipe | null>(null);
  const save = useSaveRecipe();
  const del = useDeleteRecipe();
  const { addRecipes } = useShoppingActions();

  useWakeLock(cookMode);

  if (isLoading) {
    return (
      <AppShell>
        <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
      </AppShell>
    );
  }

  if (!recipe) {
    return (
      <AppShell>
        <div className="card-soft mt-8 px-6 py-12 text-center">
          <p className="font-display text-xl">Reseptiä ei löytynyt</p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
            Takaisin resepteihin
          </Link>
        </div>
      </AppShell>
    );
  }

  const current = servings ?? recipe.servings;
  const factor = current / (recipe.servings || 1);
  const scaled = recipe.ingredients.map((i) => scaleIngredient(i, factor));

  if (cookMode) {
    return (
      <div className="min-h-screen bg-background px-5 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Kokkaustila
            </span>
            <Button variant="outline" size="sm" onClick={() => setCookMode(false)}>
              <X className="mr-1 h-4 w-4" /> Lopeta
            </Button>
          </div>
          <h1 className="font-display text-4xl leading-tight">{recipe.title}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{current} annosta</p>

          <h2 className="mt-8 font-display text-2xl">Ainekset</h2>
          <ul className="mt-3 space-y-2 text-xl">
            {scaled.map((i, idx) => (
              <li key={idx} className="border-b border-border/60 pb-2">
                {formatQuantity(i.quantity)} {i.unit ?? ""} {i.name}
              </li>
            ))}
          </ul>

          <h2 className="mt-8 font-display text-2xl">Vaiheet</h2>
          <ol className="mt-3 space-y-5 text-2xl leading-relaxed">
            {recipe.instructions.map((s, idx) => (
              <li key={idx} className="flex gap-3">
                <span className="font-display text-primary">{idx + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Näyttö pysyy hereillä kokkaustilassa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      action={
        <Button size="sm" variant="outline" onClick={() => setCookMode(true)}>
          <ChefHat className="mr-1 h-4 w-4" /> Kokkaustila
        </Button>
      }
    >
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Reseptit
      </Link>

      <h1 className="font-display text-3xl leading-tight">{recipe.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {recipe.prep_time ? (
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" /> {recipe.prep_time} min
          </span>
        ) : null}
        {recipe.source_url ? (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 underline"
          >
            <ExternalLink className="h-4 w-4" /> Lähde
          </a>
        ) : null}
      </div>

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.tags.map((t) => (
            <TagChip key={t} tag={t} />
          ))}
        </div>
      )}

      <div className="card-soft mt-5 flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium">Annokset</span>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Vähennä annoksia"
            onClick={() => setServings(Math.max(1, current - 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center font-display text-xl">{current}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Lisää annoksia"
            onClick={() => setServings(current + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <h2 className="mt-6 font-display text-xl">Ainekset</h2>
      <ul className="card-soft mt-2 divide-y divide-border px-4">
        {scaled.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-3 py-2.5 text-sm">
            <span>{i.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatQuantity(i.quantity)} {i.unit ?? ""}
            </span>
          </li>
        ))}
      </ul>

      <Button
        className="mt-3 w-full"
        onClick={async () => {
          await addRecipes.mutateAsync([{ recipe, factor }]);
          toast.success("Ainekset lisätty ostoslistalle.");
        }}
      >
        <ShoppingBasket className="mr-2 h-4 w-4" /> Lisää ostoslistalle
      </Button>

      <h2 className="mt-6 font-display text-xl">Valmistus</h2>
      <ol className="mt-2 space-y-3">
        {recipe.instructions.map((s, idx) => (
          <li key={idx} className="card-soft flex gap-3 px-4 py-3 text-sm leading-relaxed">
            <span className="font-display text-primary">{idx + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setEditDraft(recipeToDraft(recipe))}>
          <Pencil className="mr-1 h-4 w-4" /> Muokkaa
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await del.mutateAsync(recipe.id);
            toast.success("Resepti poistettu.");
            void navigate({ to: "/" });
          }}
        >
          <Trash2 className="mr-1 h-4 w-4" /> Poista
        </Button>
      </div>

      <Dialog open={!!editDraft} onOpenChange={(o) => !o && setEditDraft(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Muokkaa reseptiä</DialogTitle>
          </DialogHeader>
          {editDraft && (
            <RecipeEditor
              draft={editDraft}
              onChange={setEditDraft}
              saving={save.isPending}
              onCancel={() => setEditDraft(null)}
              onSave={async () => {
                await save.mutateAsync({
                  id: editDraft.id!,
                  title: editDraft.title.trim(),
                  source_url: editDraft.source_url,
                  prep_time: editDraft.prep_time,
                  servings: editDraft.servings,
                  ingredients: editDraft.ingredients.filter((i) => i.name.trim()),
                  instructions: editDraft.instructions.filter((s) => s.trim()),
                  tags: editDraft.tags,
                });
                toast.success("Muutokset tallennettu.");
                setEditDraft(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
