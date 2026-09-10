import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RecipeEditor, emptyDraft, type DraftRecipe } from "./RecipeEditor";
import { parseRecipeText, parseRecipeUrl } from "@/lib/ai.functions";
import { useSaveRecipe } from "@/lib/store";
import { toast } from "sonner";

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<DraftRecipe | null>(null);
  const save = useSaveRecipe();

  function close() {
    setDraft(null);
    setUrl("");
    setText("");
    onOpenChange(false);
  }

  function applyParsed(p: {
    title: string;
    servings: number | null;
    prep_time: number | null;
    ingredients: { quantity: number | null; unit: string | null; name: string }[];
    instructions: string[];
    source_url?: string;
  }) {
    setDraft({
      ...emptyDraft(),
      title: p.title || "",
      servings: p.servings && p.servings > 0 ? p.servings : 4,
      prep_time: p.prep_time,
      source_url: p.source_url ?? null,
      ingredients: p.ingredients.length ? p.ingredients : emptyDraft().ingredients,
      instructions: p.instructions.length ? p.instructions : [""],
    });
  }

  async function handleUrl() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const parsed = await parseRecipeUrl({ data: { url: url.trim() } });
      applyParsed(parsed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reseptin lukeminen epäonnistui.");
    } finally {
      setLoading(false);
    }
  }

  async function handleText() {
    if (text.trim().length < 10) {
      toast.error("Liitä hieman enemmän tekstiä.");
      return;
    }
    setLoading(true);
    try {
      const parsed = await parseRecipeText({ data: { text: text.trim() } });
      applyParsed(parsed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tekstin tulkinta epäonnistui.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!draft?.title.trim()) {
      toast.error("Anna reseptille nimi.");
      return;
    }
    try {
      await save.mutateAsync({
        title: draft.title.trim(),
        source_url: draft.source_url,
        prep_time: draft.prep_time,
        servings: draft.servings,
        ingredients: draft.ingredients.filter((i) => i.name.trim()),
        instructions: draft.instructions.filter((s) => s.trim()),
        tags: draft.tags,
        ...(draft.id ? { id: draft.id } : {}),
      });
      toast.success("Resepti tallennettu.");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {draft ? "Tarkista resepti" : "Lisää resepti"}
          </DialogTitle>
          <DialogDescription>
            {draft
              ? "Muokkaa tietoja ennen tallennusta."
              : "Lue resepti verkosta, liitä teksti tai kirjoita itse."}
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <RecipeEditor
            draft={draft}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={() => setDraft(null)}
            saving={save.isPending}
          />
        ) : (
          <Tabs defaultValue="url">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="url">Verkko-osoite</TabsTrigger>
              <TabsTrigger value="text">Liitä teksti</TabsTrigger>
              <TabsTrigger value="manual">Itse</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Lue verkko-osoitteesta: liitä linkki reseptisivulle.
              </p>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                inputMode="url"
              />
              <Button onClick={handleUrl} disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Hae resepti
              </Button>
            </TabsContent>

            <TabsContent value="text" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Liitä kuvaus / Instagram-teksti: emojit ja hashtagit siivotaan automaattisesti.
              </p>
              <Textarea
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Liitä Reelin kuvaus tai muu reseptiteksti tähän..."
              />
              <Button onClick={handleText} disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tulkitse teksti
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Kirjoita resepti alusta asti itse.
              </p>
              <Button onClick={() => setDraft(emptyDraft())} className="w-full">
                Aloita tyhjästä
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
