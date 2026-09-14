import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, Plus, Search, Sparkles, UtensilsCrossed } from "lucide-react";
import { useAssistant } from "@/components/Assistant";
import { AppShell } from "@/components/AppShell";
import { ImportDialog } from "@/components/ImportDialog";
import { TagChip } from "@/components/TagChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecipes } from "@/lib/store";
import type { Recipe } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rullaa – reseptit, ruokalista ja ostoslista" },
      {
        name: "description",
        content:
          "Rullaa kokoaa reseptisi, suunnittelee viikon ruokalistan ja tekee ostoslistan automaattisesti.",
      },
      { property: "og:title", content: "Rullaa – arjen ruokasuunnittelu" },
      {
        property: "og:description",
        content: "Tallenna reseptit, suunnittele viikko ja saa valmis ostoslista.",
      },
    ],
  }),
  component: Reseptit,
});

function Reseptit() {
  const { data: recipes = [], isLoading } = useRecipes();
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const allTags = useMemo(
    () => [...new Set(recipes.flatMap((r) => r.tags))].sort(),
    [recipes],
  );

  const filtered = recipes.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.ingredients.some((i) => i.name.toLowerCase().includes(q));
    const matchesTags = activeTags.every((t) => r.tags.includes(t));
    return matchesQuery && matchesTags;
  });

  return (
    <AppShell
      action={
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Lisää
        </Button>
      }
    >
      <h1 className="sr-only">Reseptit</h1>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hae reseptiä tai raaka-ainetta"
          className="pl-9"
        />
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {allTags.map((t) => (
            <TagChip
              key={t}
              tag={t}
              active={activeTags.includes(t)}
              onClick={() =>
                setActiveTags((prev) =>
                  prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                )
              }
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
      ) : filtered.length === 0 ? (
        <div className="card-soft mt-8 flex flex-col items-center gap-3 px-6 py-12 text-center">
          <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
          <p className="font-display text-xl">Ei vielä reseptejä</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Liitä linkki reseptisivulle tai Instagram-kuvaus – Rullaa poimii ainekset ja vaiheet
            puolestasi.
          </p>
          <Button onClick={() => setImportOpen(true)}>Lisää ensimmäinen resepti</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </ul>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </AppShell>
  );
}

function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  const assistant = useAssistant();
  return (
    <li className="card-soft overflow-hidden">
      <Link
        to="/resepti/$id"
        params={{ id: r.id }}
        className="block transition-transform active:scale-[0.99]"
      >
        {r.image_url ? (
          <img src={r.image_url} alt={r.title} loading="lazy" className="h-36 w-full object-cover" />
        ) : null}
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-lg leading-snug">{r.title}</h2>
            {r.prep_time ? (
              <span className="mt-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {r.prep_time} min
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.servings} annosta · {r.ingredients.length} raaka-ainetta
          </p>
          {r.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <TagChip key={t} tag={t} />
              ))}
            </div>
          )}
        </div>
      </Link>
      <div className="border-t border-border/60 px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            assistant.open({ label: "Resepti", data: r, recipe: r });
          }}
        >
          <Sparkles className="mr-1 h-4 w-4" /> Avaa AI-Apurissa
        </Button>
      </div>
    </li>
  );
}
