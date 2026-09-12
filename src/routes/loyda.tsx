import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, Loader2, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAssistantContext } from "@/components/Assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateRecipe, parseRecipeUrl, searchWebRecipes, type WebResult } from "@/lib/ai.functions";
import { useSaveRecipe } from "@/lib/store";
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

      <Tabs defaultValue="web" className="mt-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="web">Hae verkosta</TabsTrigger>
          <TabsTrigger value="ai">AI-reseptiapuri</TabsTrigger>
        </TabsList>

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
