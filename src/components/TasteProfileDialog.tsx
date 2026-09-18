import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildTasteProfile } from "@/lib/ai.functions";
import { useRecipes, useSaveTasteProfile, useTasteProfile } from "@/lib/store";
import { TASTE_TAGS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SERVING_OPTIONS = [1, 2, 4, 6];

export function TasteProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: profile } = useTasteProfile();
  const { data: recipes } = useRecipes();
  const save = useSaveTasteProfile();

  const [tags, setTags] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState("");
  const [servings, setServings] = useState(4);
  const [summary, setSummary] = useState("");
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTags(profile?.tags ?? []);
    setDislikes(profile?.dislikes ?? "");
    setServings(profile?.default_servings ?? 4);
    setSummary(profile?.summary ?? "");
  }, [open, profile]);

  function toggle(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  async function runBuild() {
    setBuilding(true);
    try {
      const res = await buildTasteProfile({
        data: {
          tags,
          dislikes: dislikes.trim() || undefined,
          recipes: (recipes ?? []).slice(0, 40).map((r) => ({
            title: r.title,
            tags: r.tags,
            ingredients: r.ingredients.map((i) => i.name),
          })),
        },
      });
      setSummary(res.summary);
      toast.success("Makuprofiili päivitetty – voit vielä muokata tekstiä.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Profiilin luonti epäonnistui.");
    } finally {
      setBuilding(false);
    }
  }

  async function submit() {
    try {
      await save.mutateAsync({
        tags,
        dislikes: dislikes.trim() || null,
        default_servings: servings,
        summary: summary.trim() || null,
      });
      toast.success("Makuprofiili tallennettu.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl">Makuprofiili</DialogTitle>
          <DialogDescription>
            Kerro lyhyesti millaista ruokaa syöt – AI-apuri ehdottaa sen perusteella sinulle
            sopivia reseptejä.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Valitse sinua kuvaavat tagit</Label>
            <div className="flex flex-wrap gap-1.5">
              {TASTE_TAGS.map((t) => {
                const active = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggle(t)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-all active:scale-95",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dislikes">Mitä et syö tai mitä toivot?</Label>
            <Textarea
              id="dislikes"
              rows={2}
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
              placeholder="Esim. ei sieniä, vähemmän lihaa arkena"
            />
          </div>

          <div className="space-y-2">
            <Label>Tavallinen annosmäärä</Label>
            <div className="flex gap-2">
              {SERVING_OPTIONS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={servings === s ? "default" : "outline"}
                  onClick={() => setServings(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary">Makukuvaus</Label>
            <Textarea
              id="summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="AI kirjoittaa tähän kuvauksen resepteistäsi – voit muokata sitä vapaasti."
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void runBuild()}
              disabled={building}
            >
              {building ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Päivitä profiili resepteistäni
            </Button>
          </div>

          <Button className="w-full" onClick={() => void submit()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tallenna makuprofiili
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
