import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAssistantContext } from "@/components/Assistant";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShoppingActions, useShoppingList } from "@/lib/store";
import { categorize, formatQuantity, groupByCategory } from "@/lib/categorize";
import { CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/ostoslista")({
  head: () => ({
    meta: [
      { title: "Ostoslista – Tilli" },
      {
        name: "description",
        content: "Ostoslista ryhmiteltynä kaupan osastojen mukaan, toimii myös offline-tilassa.",
      },
      { property: "og:title", content: "Ostoslista – Tilli" },
      { property: "og:description", content: "Kaikki viikon ostokset yhdessä listassa." },
    ],
  }),
  component: Ostoslista,
});

function Ostoslista() {
  const { data: items = [], isLoading } = useShoppingList();
  const { addManual, toggle, remove, clear } = useShoppingActions();
  const [view, setView] = useState<"active" | "all">("active");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");

  useAssistantContext({
    label: "Ostoslista",
    data: items.map((i) => ({
      nimi: i.item_name,
      maara: i.quantity,
      yksikko: i.unit,
      osasto: i.category,
      ostettu: i.checked,
    })),
  });

  const done = items.filter((i) => i.checked).length;
  const remaining = items.length - done;
  const visible = view === "active" ? items.filter((i) => !i.checked) : items;
  const grouped = groupByCategory(visible);

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  function add() {
    const n = name.trim();
    if (!n) return;
    const q = Number(amount.replace(",", "."));
    addManual.mutate({
      item_name: n,
      quantity: Number.isFinite(q) && q > 0 ? q : null,
      unit: unit.trim() || null,
      category: categorize(n),
    });
    toast.success(`Lisätty: ${n}`);
    setName("");
    setAmount("");
    setUnit("");
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl">Ostoslista</h1>

      {/* Aktiiviset | Kaikki */}
      <div className="mb-4 flex rounded-full bg-secondary p-1">
        {[
          { label: "Aktiiviset", value: "active" as const },
          { label: "Kaikki", value: "all" as const },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setView(tab.value)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition-colors",
              view === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Yhteenveto */}
      {items.length > 0 && (
        <section className="mb-5 rounded-3xl bg-secondary/70 p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-xl">
              {remaining === 0 ? "Kaikki ostettu" : `${remaining} ostettavaa`}
            </p>
            <p className="text-sm text-muted-foreground">
              {done}/{items.length} ostettu
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(done / items.length) * 100}%` }}
            />
          </div>
        </section>
      )}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
      ) : items.length === 0 ? (
        <div className="mt-10 px-6 text-center">
          <p className="font-display text-xl">Ostoslista on tyhjä</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Lisää reseptin ainekset tai koko viikon ruokalista listalle, tai lisää tuote käsin.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Kaikki on ostettu. Valitse Kaikki nähdäksesi ostetut tuotteet.
        </p>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.filter((c) => (grouped[c.key] ?? []).length > 0).map((c) => {
            const rows = grouped[c.key] ?? [];
            const isCollapsed = collapsed.includes(c.key);
            return (
              <section key={c.key} className="card-soft overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(c.key)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between bg-secondary/60 px-4 py-3"
                >
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                    {c.label}
                  </span>
                  <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {rows.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <ul className="divide-y divide-border/60 px-4">
                    {rows.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 py-3">
                        <Checkbox
                          checked={i.checked}
                          onCheckedChange={(v) => toggle.mutate({ id: i.id, checked: !!v })}
                          aria-label={i.item_name}
                          className="h-5 w-5 rounded-md"
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate",
                            i.checked && "text-muted-foreground line-through",
                          )}
                        >
                          {i.item_name}
                        </span>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {formatQuantity(i.quantity)} {i.unit ?? ""}
                        </span>
                        <button
                          type="button"
                          aria-label={`Poista ${i.item_name}`}
                          onClick={() => remove.mutate(i.id)}
                          className="shrink-0 rounded-full p-1.5 text-muted-foreground/70 hover:bg-secondary"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => clear.mutate(true)}>
            Poista merkityt
          </Button>
          <Button variant="ghost" size="sm" onClick={() => clear.mutate(false)}>
            Tyhjennä lista
          </Button>
        </div>
      )}

      {/* Kelluva lisäyspainike */}
      <div className="sticky bottom-24 z-20 mt-6">
        <Button
          className="h-12 w-full rounded-[14px] text-base shadow-lg"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-2 h-5 w-5" /> Lisää tuote
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lisää tuote</DialogTitle>
            <DialogDescription>
              Tuote sijoitetaan automaattisesti oikeaan osastoon. Voit lisätä useita peräkkäin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Tuote, esim. maito"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                placeholder="Määrä"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Input
                placeholder="Yksikkö (dl, kpl)"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <Button className="h-11 w-full rounded-[14px]" onClick={add}>
              <Plus className="mr-2 h-4 w-4" /> Lisää
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setAddOpen(false)}>
              Valmis
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}