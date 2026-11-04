import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Clock, Plus, Search, UtensilsCrossed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ImportDialog } from "@/components/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecipes } from "@/lib/store";
import type { Recipe } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tilli – reseptit, ruokalista ja ostoslista" },
      {
        name: "description",
        content:
          "Tilli kokoaa reseptisi, suunnittelee viikon ruokalistan ja tekee ostoslistan automaattisesti.",
      },
      { property: "og:title", content: "Tilli – arjen ruokasuunnittelu" },
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
  const [searchOpen, setSearchOpen] = useState(false);

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

  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <AppShell
      action={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hae"
          onClick={() => setSearchOpen((v) => !v)}
        >
          <Search className="h-5 w-5" />
        </Button>
      }
    >
      <h1 className="mb-4 text-3xl">Omat reseptit</h1>

      <Button
        className="mb-5 h-12 w-full rounded-[14px] text-base"
        onClick={() => setImportOpen(true)}
      >
        <Plus className="mr-2 h-5 w-5" /> Lisää resepti
      </Button>

      {(searchOpen || query) && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hae reseptiä tai raaka-ainetta"
            className="pl-9"
          />
        </div>
      )}

      {recipes.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          <FilterChip active={activeTags.length === 0} onClick={() => setActiveTags([])}>
            Kaikki
          </FilterChip>
          {allTags.map((t) => (
            <FilterChip key={t} active={activeTags.includes(t)} onClick={() => toggleTag(t)}>
              {t}
            </FilterChip>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
      ) : recipes.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 px-6 py-12 text-center">
          <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
          <p className="font-display text-xl">Ei vielä reseptejä</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Liitä linkki reseptisivulle tai Instagram-kuvaus – Tilli poimii ainekset ja vaiheet
            puolestasi.
          </p>
          <Button onClick={() => setImportOpen(true)}>Lisää ensimmäinen resepti</Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Ei hakua vastaavia reseptejä.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </ul>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  return (
    <li>
      <Link
        to="/resepti/$id"
        params={{ id: r.id }}
        className="block transition-transform active:scale-[0.98]"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-secondary">
          {r.image_url ? (
            <img
              src={r.image_url}
              alt={r.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="h-7 w-7 text-muted-foreground/60" />
            </div>
          )}
        </div>
        <h2 className="mt-2 line-clamp-2 font-sans text-[15px] font-semibold leading-snug">
          {r.title}
        </h2>
        {r.prep_time ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {r.prep_time} min
          </p>
        ) : null}
      </Link>
    </li>
  );
}