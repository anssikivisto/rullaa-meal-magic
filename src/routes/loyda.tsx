import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, Heart, Loader2, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAssistantContext } from "@/components/Assistant";
import { TasteProfileDialog } from "@/components/TasteProfileDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "sonner";

export const Route = createFileRoute("/loyda")({
  head: () => ({
    meta: [
      { title: "Löydä uutta – Rullaa" },
      {
        name: "description",
        content: "Hae reseptejä verkosta tai anna AI:n keksiä uusi resepti raaka-aineistasi.",
      },
      { property: "og:title", content: "Löydä uutta – Rullaa" },
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

function Loyda() {
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
      toast.success("Tallennettu Rullaan.");
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
      toast.success("Tallennettu Rullaan.");
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
    toast.success("Tallennettu Rullaan.");
    setGenerated(null);
    setPrompt("");
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl">Löydä uutta</h1>

      <Tabs defaultValue="sinulle" className="mt-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sinulle">Sinulle</TabsTrigger>
          <TabsTrigger value="web">Hae verkosta</TabsTrigger>
          <TabsTrigger value="ai">AI-apuri</TabsTrigger>
        </TabsList>

        <TabsContent value="sinulle" className="mt-4 space-y-3">
          <div className="card-soft space-y-3 px-4 py-4">
            <p className="text-sm text-muted-foreground">
              {profile?.summary
                ? profile.summary
                : "Kerro makuprofiilissa millaista ruokaa syöt, niin ehdotukset osuvat paremmin."}
            </p>
            <Button variant="outline" className="w-full" onClick={() => setProfileOpen(true)}>
              <Heart className="mr-2 h-4 w-4" />
              {profile ? "Muokkaa makuprofiilia" : "Täytä makuprofiili"}
            </Button>
            <Button className="w-full" onClick={() => void runIdeas()} disabled={ideasBusy}>
              {ideasBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Ehdota minulle reseptejä
            </Button>
          </div>

          {ideas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {["lisää kasvisruokia", "nopeampia", "uusi haku"].map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={ideasBusy}
                  onClick={() => void runIdeas(r === "uusi haku" ? undefined : r)}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs"
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li key={idea.title} className="card-soft px-4 py-3">
                <p className="font-display text-lg leading-snug">{idea.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{idea.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {idea.prep_time ? `${idea.prep_time} min · ` : ""}
                  {idea.servings ?? 4} annosta
                </p>
                <p className="mt-2 text-xs text-primary">{idea.reason}</p>

                {openIdea === idea.title && ideaRecipe && (
                  <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                    <ul className="space-y-1 text-sm">
                      {ideaRecipe.ingredients.map((i, idx) => (
                        <li key={idx} className="flex justify-between gap-3">
                          <span>{i.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatQuantity(i.quantity)} {i.unit ?? ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <ol className="space-y-2 text-sm">
                      {ideaRecipe.instructions.map((s, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-primary">{idx + 1}.</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void showIdeaRecipe(idea)}
                    disabled={ideaBusy === idea.title}
                  >
                    {ideaBusy === idea.title && (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    )}
                    Näytä resepti
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void saveIdeaRecipe(idea)}
                    disabled={ideaBusy === idea.title}
                  >
                    Tallenna Rullaan
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {ideas.length === 0 && !ideasBusy && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ehdotukset eivät toista jo tallentamiasi reseptejä.
            </p>
          )}

          <TasteProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        </TabsContent>


        <TabsContent value="web" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input
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
            <Button onClick={() => void runSearch()} disabled={searching} aria-label="Hae">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {results.length === 0 && !searching && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Hae reseptejä verkosta ja tallenna löydöt suoraan Rullaan.
            </p>
          )}

          <ul className="space-y-3">
            {results.map((r) => (
              <li key={r.url} className="card-soft px-4 py-3">
                <p className="font-display text-lg leading-snug">{r.title}</p>
                {r.snippet && (
                  <p className="mt-1 text-xs text-muted-foreground">{r.snippet}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={r.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" /> Avaa
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void saveFromUrl(r.url)}
                    disabled={savingUrl === r.url}
                  >
                    {savingUrl === r.url && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    Tallenna Rullaan
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-3">
          <Textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Keitä jotain helppoa linsseistä ja kaurakermasta"
          />
          <Button className="w-full" onClick={() => void runGenerate()} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Luo resepti
          </Button>

          {generated && (
            <div className="card-soft space-y-3 px-4 py-4">
              <p className="font-display text-xl">{generated.title}</p>
              <p className="text-xs text-muted-foreground">
                {generated.servings ?? 4} annosta
                {generated.prep_time ? ` · ${generated.prep_time} min` : ""}
              </p>
              <ul className="space-y-1 text-sm">
                {generated.ingredients.map((i, idx) => (
                  <li key={idx} className="flex justify-between gap-3">
                    <span>{i.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatQuantity(i.quantity)} {i.unit ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
              <ol className="space-y-2 text-sm">
                {generated.instructions.map((s, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-primary">{idx + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <Button className="w-full" onClick={() => void saveGenerated()} disabled={save.isPending}>
                Tallenna Rullaan
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
