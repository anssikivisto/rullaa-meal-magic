import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assistantChat, chatEditRecipe } from "@/lib/ai.functions";
import { useSaveRecipe, useTasteProfile } from "@/lib/store";
import { profileToText } from "@/lib/profile";
import type { Ingredient, Recipe } from "@/lib/types";
import { formatQuantity } from "@/lib/categorize";
import { toast } from "sonner";

export type EditableRecipe = {
  title: string;
  servings: number | null;
  prep_time: number | null;
  ingredients: Ingredient[];
  instructions: string[];
};

export type AssistantCtx = {
  /** short Finnish label of the current screen, e.g. "Resepti" */
  label: string;
  /** any serialisable data pre-loaded into the assistant's memory */
  data: unknown;
  /** when the screen shows one recipe, the assistant can edit it */
  recipe?: Recipe | null;
  /** apply AI changes live to the current view */
  onApply?: (updated: EditableRecipe) => void;
};

type AssistantApi = {
  setContext: (ctx: AssistantCtx | null) => void;
  open: (ctx?: AssistantCtx) => void;
};

const AssistantContext = createContext<AssistantApi | null>(null);

export function useAssistant(): AssistantApi {
  return (
    useContext(AssistantContext) ?? {
      setContext: () => {},
      open: () => {},
    }
  );
}

/** Keeps the current screen's data in the assistant's memory. */
export function useAssistantContext(ctx: AssistantCtx | null) {
  const { setContext } = useAssistant();
  useEffect(() => {
    setContext(ctx);
    return () => setContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
}

type Msg = { role: "user" | "assistant"; content: string };

export function AssistantProvider({ children }: { children: ReactNode }) {
  const ctxRef = useRef<AssistantCtx | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<AssistantCtx | null>(null);

  const setContext = useCallback((ctx: AssistantCtx | null) => {
    ctxRef.current = ctx;
  }, []);

  const openSheet = useCallback((ctx?: AssistantCtx) => {
    setActive(ctx ?? ctxRef.current);
    setOpen(true);
  }, []);

  return (
    <AssistantContext.Provider value={{ setContext, open: openSheet }}>
      {children}
      <button
        type="button"
        aria-label="Avaa AI-apuri"
        onClick={() => openSheet()}
        className="fixed bottom-24 right-4 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-primary p-3.5 text-primary-foreground shadow-lg transition-transform active:scale-95"
      >
        <Sparkles className="h-5 w-5" />
      </button>
      <AssistantSheet open={open} onOpenChange={setOpen} ctx={active} />
    </AssistantContext.Provider>
  );
}

function AssistantSheet({
  open,
  onOpenChange,
  ctx,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ctx: AssistantCtx | null;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState<EditableRecipe | null>(null);
  const save = useSaveRecipe();
  const { data: taste } = useTasteProfile();

  useEffect(() => {
    if (open) {
      setMessages([]);
      setUpdated(null);
      setInput("");
    }
  }, [open, ctx]);

  const recipe = ctx?.recipe ?? null;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      if (recipe) {
        const base = updated ?? {
          title: recipe.title,
          servings: recipe.servings,
          prep_time: recipe.prep_time,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
        };
        const res = await chatEditRecipe({
          data: {
            recipe: {
              title: base.title,
              servings: base.servings,
              prep_time: base.prep_time,
              ingredients: base.ingredients,
              instructions: base.instructions,
            },
            messages: next,
          },
        });
        setMessages([...next, { role: "assistant", content: res.reply }]);
        setUpdated({
          title: res.recipe.title || base.title,
          servings: res.recipe.servings ?? base.servings,
          prep_time: res.recipe.prep_time ?? base.prep_time,
          ingredients: res.recipe.ingredients?.length ? res.recipe.ingredients : base.ingredients,
          instructions: res.recipe.instructions?.length
            ? res.recipe.instructions
            : base.instructions,
        });
      } else {
        const res = await assistantChat({
          data: {
            context_label: ctx?.label ?? "Rullaa",
            context_data: JSON.stringify(ctx?.data ?? {}).slice(0, 12000),
            messages: next,
            ...(profileToText(taste) ? { profile: profileToText(taste)! } : {}),
          },
        });
        setMessages([...next, { role: "assistant", content: res.reply }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI-apuri ei vastannut.");
    } finally {
      setBusy(false);
    }
  }

  async function saveUpdated(asNew: boolean) {
    if (!recipe || !updated) return;
    try {
      await save.mutateAsync({
        ...(asNew ? {} : { id: recipe.id }),
        title: asNew ? updated.title || `${recipe.title} (muunnelma)` : updated.title,
        source_url: recipe.source_url,
        image_url: recipe.image_url,
        notes: recipe.notes,
        prep_time: updated.prep_time,
        servings: updated.servings ?? recipe.servings,
        ingredients: updated.ingredients,
        instructions: updated.instructions,
        tags: recipe.tags,
      });
      toast.success(asNew ? "Tallennettu uutena muunnelmana." : "Alkuperäinen päivitetty.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui.");
    }
  }

  const suggestions = recipe
    ? ["Muuta tämä vegaaniseksi", "Korvaa kerma kaurakermalla", "Skaalaa 6 hengelle"]
    : ["Mitä voisin tehdä näistä?", "Ehdota nopea arkiruoka"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[85vh] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border/70 px-4 py-3 text-left">
          <SheetTitle className="font-display text-xl">AI-apuri</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {ctx ? `Konteksti: ${ctx.label}` : "Yleinen keskustelu"}
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Kysy mitä vain – tunnen tämän näkymän sisällön.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                  : "mr-auto max-w-[90%] rounded-2xl bg-muted px-3.5 py-2 text-sm"
              }
            >
              {m.content}
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Mietitään…
            </div>
          )}

          {updated && recipe && (
            <div className="card-soft space-y-2 px-4 py-3">
              <p className="font-display text-lg">{updated.title}</p>
              <p className="text-xs text-muted-foreground">
                {updated.servings ?? recipe.servings} annosta
              </p>
              <ul className="space-y-1 text-sm">
                {updated.ingredients.map((i, idx) => (
                  <li key={idx} className="flex justify-between gap-3">
                    <span>{i.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatQuantity(i.quantity)} {i.unit ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 pt-1">
                {ctx?.onApply && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      ctx.onApply?.(updated);
                      toast.success("Muutokset näkyvät nyt näkymässä.");
                    }}
                  >
                    Näytä muutokset näkymässä
                  </Button>
                )}
                <Button onClick={() => saveUpdated(false)} disabled={save.isPending}>
                  Päivitä alkuperäinen
                </Button>
                <Button
                  variant="outline"
                  onClick={() => saveUpdated(true)}
                  disabled={save.isPending}
                >
                  Tallenna uutena muunnelmana
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="safe-bottom flex gap-2 border-t border-border/70 px-4 py-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Kirjoita viesti…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button size="icon" onClick={() => void send()} disabled={busy} aria-label="Lähetä">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
