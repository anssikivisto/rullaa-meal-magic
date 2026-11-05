import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, Heart, Loader2, Search, Sparkles, UtensilsCrossed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAssistantContext } from "@/components/Assistant";
import { TasteProfileDialog } from "@/components/TasteProfileDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  generateRecipe,
  parseRecipeUrl,
  searchWebRecipes,
  suggestRecipeIdeas,
  type RecipeIdea,
  type WebResult,
} from "@/lib/ai.functions";
import { useRecipes, useSaveRecipe, useTasteProfile } from "@/lib/store";
import { profileToText } from "@/lib/profile";
import { formatQuantity } from "@/lib/categorize";
import type { Ingredient } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/loyda")({
  head: () => ({
    meta: [
      { title: "Löydä uutta – Tilli" },
      {
        name: "description",
        content: "Hae reseptejä verkosta tai anna Tillin keksiä uusi resepti raaka-aineistasi.",
      },
      { property: "og:title", content: "Löydä uutta – Tilli" },
      { property: "og:description", content: "Verkkohaku ja AI-reseptiapuri yhdessä näkymässä." },
    ],
  }),
  component: Loyda,
});

type Generated = {
  title: string;
  servings: number | null;
  prep_time: number | null;
  ingredients: Ingredient[];
  instructions: string[];
  image_url?: string | null;
};

const TABS = [
  { key: "sinulle", label: "Sinulle" },
  { key: "web", label: "Hae verkosta" },
  { key: "ai", label: "AI-apuri" },
] as const;

function RecipeBody({ recipe }: { recipe: Generated }) {
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-1.5">
        {recipe.ingredients.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-3">
            <span>{i.name}</span>
            <span className="shrink-0 font-medium text-muted-foreground">
              {formatQuantity(i.quantity)} {i.unit ?? ""}
            </span>
          </li>
        ))}
      </ul>
      <ol className="space-y-2.5 border-t border-border/60 pt-3">
        {recipe.instructions.map((s, idx) => (
          <li key={idx} className="flex gap-3">
            <span className="font-semibold text-primary">{idx + 1}.</span>
            <span className="leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Loyda() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("sinulle");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WebResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  const save = useSaveRecipe();
  const { data: profile } = useTasteProfile();
  const { data: myRecipes = [] } = useRecipes();

  const [ideas, setIdeas] = useState<RecipeIdea[]>([]);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openIdea, setOpenIdea] = useState<string | null>(null);
  const [ideaRecipe, setIdeaRecipe] = useState<Generated | null>(null);
  const [ideaBusy, setIdeaBusy] = useState<string | null>(null);

  async function runIdeas(refine?: string) {
    setIdeasBusy(true);
    try {
      const res = await suggestRecipeIdeas({
        data: {
          profile: profileToText(profile) ?? "",
          tags: profile?.tags ?? [],
          ...(profile?.dislikes ? { dislikes: profile.dislikes } : {}),
          servings: profile?.default_servings ?? 4,
          existing: myRecipes.slice(0, 80).map((r) => r.title),
          ...(refine ? { refine } : {}),
        },
      });
      setIdeas(res);
      setOpenIdea(null);
      setIdeaRecipe(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ehdotusten luonti epäonnistui.");
    } finally {
      setIdeasBusy(false);
    }
  }

  async function showIdeaRecipe(idea: RecipeIdea) {
    // Jos resepti on jo auki, suljetaan se
    if (openIdea === idea.title) {
      setOpenIdea(null);
      setIdeaRecipe(null);
      return;
    }

    setIdeaBusy(idea.title);
    try {
      const r = await generateRecipe({
        data: {
          prompt: `${idea.title}. ${idea.description}. Annoksia: ${idea.servings ?? profile?.default_servings ?? 4}.`,
        },
      });
      setIdeaRecipe({
        title: r.title,
        servings: r.servings ?? idea.servings ?? 4,
        prep_time: r.prep_time ?? idea.prep_time ?? null,
        ingredients: r.ingredients,
        instructions: r.instructions,
      });
      setOpenIdea(idea.title);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reseptin luonti epäonnistui.");
    } finally {
      setIdeaBusy(null);
    }
  }

  async function saveIdeaRecipe(idea: RecipeIdea) {
    setIdeaBusy(idea.title);
    try {
      const base =
        openIdea === idea.title && ideaRecipe
          ? ideaRecipe
          : await generateRecipe({
              data: {
                prompt: `${idea.title}. ${idea.description}. Annoksia: ${idea.servings ?? 4}.`,
              },
            }).then((r) => ({
              title: r.title,
              servings: r.servings ?? idea.servings ?? 4,
              prep_time: r.prep_time ?? idea.prep_time ?? null,
              ingredients: r.ingredients,
              instructions: r.instructions,
            }));
      await save.mutateAsync({
        title: base.title,
        source_url: null,
        image_url: null,
        prep_time: base.prep_time,
        servings: base.servings ?? 4,
        ingredients: base.ingredients,
        instructions: base.instructions,
        tags: idea.tags ?? [],
        notes: null,
      });
      setIdeas((list) => list.filter((i) => i.title !== idea.title));
      toast.success("Tallennettu Tilliin!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui.");
    } finally {
      setIdeaBusy(null);
    }
  }

  useAssistantContext({
    label: "Löydä uutta",
    data: { haku: query, tulokset: results.map((r) => r.title), ehdotus: generated?.title ?? null },
  });

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      setResults(await searchWebRecipes({ data: { query: q } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Haku epäonnistui.");
    } finally {
      setSearching(false);
    }
  }

  async function saveFromUrl(url: string) {
    setSavingUrl(url);
    try {
      const parsed = await parseRecipeUrl({ data: { url } });
      await save.mutateAsync({
        title: parsed.title,
        source_url: url,
        image_url: parsed.image_url ?? null,
        prep_time: parsed.prep_time ?? null,
        servings: parsed.servings ?? 4,
        ingredients: parsed.ingredients,
        instructions: parsed.instructions,
        tags: [],
        notes: null,
      });
      toast.success("Tallennettu Tilliin!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reseptin tallennus epäonnistui.");
    } finally {
      setSavingUrl(null);
    }
  }

  async function runGenerate() {
    const p = prompt.trim();
    if (p.length < 3) return;
    setGenerating(true);
    try {
      const r = await generateRecipe({ data: { prompt: p } });
      setGenerated({
        title: r.title,
        servings: r.servings ?? 4,
        prep_time: r.prep_time ?? null,
        ingredients: r.ingredients,
        instructions: r.instructions,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reseptin luonti epäonnistui.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveGenerated() {
    if (!generated) return;
    await save.mutateAsync({
      title: generated.title,
      source_url: null,
      image_url: null,
      prep_time: generated.prep_time,
      servings: generated.servings ?? 4,
      ingredients: generated.ingredients,
      instructions: generated.instructions,
      tags: [],
      notes: null,
    });
    toast.success("Tallennettu Tilliin!");
    setGenerated(null);
    setPrompt("");
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl">Löydä uutta</h1>

      {/* Välilehdet */}
      <div className="mb-5 flex rounded-full bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sinulle" && (
        <div className="space-y-4">
          <section className="rounded-3xl bg-secondary/70 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h2 className="font-display text-lg leading-tight">Mitä tänään syödään?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile?.summary
                    ? profile.summary
                    : "Kerro makuprofiilissa millaista ruokaa syöt, niin Tilli keksii sinulle osuvimmat ehdotukset."}
                </p>
              </div>
            </div>
            <Button
              className="mt-3 h-11 w-full rounded-[14px]"
              onClick={() => void runIdeas()}
              disabled={ideasBusy}
            >
              {ideasBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Ehdota minulle reseptejä
            </Button>
            <Button
              variant="outline"
              className="mt-2 h-11 w-full rounded-[14px] bg-card"
              onClick={() => setProfileOpen(true)}
            >
              <Heart className="mr-2 h-4 w-4 text-primary" />
              {profile ? "Päivitä makuprofiilia" : "Täytä makuprofiili"}
            </Button>
          </section>

          {ideas.length > 0 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {["lisää kasvisruokia", "nopeampia", "uusi haku"].map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={ideasBusy}
                  onClick={() => void runIdeas(r === "uusi haku" ? undefined : r)}
                  className="shrink-0 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground disabled:opacity-50"
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li key={idea.title} className="card-soft p-4">
                <div className="flex gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <UtensilsCrossed className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg leading-snug">{idea.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{idea.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {idea.prep_time ? `${idea.prep_time} min · ` : ""}
                      {idea.servings ?? 4} annosta
                    </p>
                  </div>
                </div>

                <p className="mt-3 inline-block rounded-lg bg-tag-diet px-2.5 py-1 text-xs font-medium text-tag-diet-foreground">
                  {idea.reason}
                </p>

                {openIdea === idea.title && ideaRecipe && (
                  <div className="mt-4 border-t border-border/60 pt-4">
                    <RecipeBody recipe={ideaRecipe} />
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => void showIdeaRecipe(idea)}
                    disabled={ideaBusy === idea.title}
                  >
                    {ideaBusy === idea.title && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    {openIdea === idea.title ? "Piilota resepti" : "Näytä resepti"}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={() => void saveIdeaRecipe(idea)}
                    disabled={ideaBusy === idea.title}
                  >
                    Tallenna Tilliin
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {ideas.length === 0 && !ideasBusy && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Tilli ei toista ehdotuksissa jo tallentamiasi reseptejä, joten voit etsiä rohkeasti
              uusia makuja.
            </p>
          )}

          <TasteProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        </div>
      )}

      {tab === "web" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Esim. uunifetapasta"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
              />
            </div>
            <Button
              className="rounded-xl"
              onClick={() => void runSearch()}
              disabled={searching}
              aria-label="Hae"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hae"}
            </Button>
          </div>

          {results.length === 0 && !searching && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Löysitkö kivan reseptin netistä? Hae sitä täältä ja tallenna se suoraan Tilliin, niin
              se on mukana ruokalistallasi.
            </p>
          )}

          <ul className="space-y-3">
            {results.map((r) => (
              <li key={r.url} className="card-soft p-4">
                <h3 className="font-display text-lg leading-snug">{r.title}</h3>
                {r.snippet && <p className="mt-1 text-sm text-muted-foreground">{r.snippet}</p>}
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline" size="sm" className="rounded-xl">
                    <a href={r.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" /> Avaa sivu
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={() => void saveFromUrl(r.url)}
                    disabled={savingUrl === r.url}
                  >
                    {savingUrl === r.url && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    Tallenna Tilliin
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "ai" && (
        <div className="space-y-4">
          <section className="rounded-3xl bg-secondary/70 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h2 className="font-display text-lg leading-tight">Luo resepti tekoälyllä</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Kerro, mitä haluat kokata (raaka-aineet, ruokavalio, aika), niin Tilli luo
                  reseptin.
                </p>
              </div>
            </div>
            <Textarea
              className="mt-3 bg-card"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Esim. keitä jotain helppoa linsseistä ja kaurakermasta"
            />
            <Button
              className="mt-3 h-11 w-full rounded-[14px]"
              onClick={() => void runGenerate()}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Luo resepti
            </Button>
          </section>

          {generated && (
            <div className="card-soft space-y-4 p-5">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-display text-2xl">{generated.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {generated.servings ?? 4} annosta
                  {generated.prep_time ? ` · ${generated.prep_time} min` : ""}
                </p>
              </div>
              <RecipeBody recipe={generated} />
              <Button
                className="mt-2 h-11 w-full rounded-[14px]"
                onClick={() => void saveGenerated()}
                disabled={save.isPending}
              >
                Tallenna Tilliin
              </Button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}