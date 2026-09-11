import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAssistantContext } from "@/components/Assistant";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useShoppingActions, useShoppingList } from "@/lib/store";
import { categorize, formatQuantity, groupByCategory } from "@/lib/categorize";
import { CATEGORIES } from "@/lib/types";

export const Route = createFileRoute("/ostoslista")({
  head: () => ({
    meta: [
      { title: "Ostoslista – Rullaa" },
      {
        name: "description",
        content: "Ostoslista ryhmiteltynä kaupan osastojen mukaan, toimii myös offline-tilassa.",
      },
      { property: "og:title", content: "Ostoslista – Rullaa" },
      { property: "og:description", content: "Kaikki viikon ostokset yhdessä listassa." },
    ],
  }),
  component: Ostoslista,
});

function Ostoslista() {
  const { data: items = [], isLoading } = useShoppingList();
  const { addManual, toggle, remove, clear } = useShoppingActions();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

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

  const grouped = groupByCategory(items);
  const done = items.filter((i) => i.checked).length;

  function add() {
    const n = name.trim();
    if (!n) return;
    const q = Number(amount.replace(",", "."));
    addManual.mutate({
      item_name: n,
      quantity: Number.isFinite(q) && q > 0 ? q : null,
      unit: null,
      category: categorize(n),
    });
    setName("");
    setAmount("");
  }

  return (
    <AppShell>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl">Ostoslista</h1>
        <span className="text-sm text-muted-foreground">
          {done}/{items.length}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <Input
          className="w-20"
          inputMode="decimal"
          placeholder="Määrä"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          placeholder="Lisää tuote"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button size="icon" onClick={add} aria-label="Lisää tuote">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
      ) : items.length === 0 ? (
        <div className="card-soft mt-8 px-6 py-12 text-center">
          <p className="font-display text-xl">Ostoslista on tyhjä</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Lisää reseptin ainekset tai koko viikon ruokalista listalle.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {CATEGORIES.filter((c) => (grouped[c.key] ?? []).length > 0).map((c) => (
            <section key={c.key}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {c.emoji} {c.label}
              </h2>
              <ul className="card-soft divide-y divide-border px-4">
                {(grouped[c.key] ?? []).map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <Checkbox
                      checked={i.checked}
                      onCheckedChange={(v) => toggle.mutate({ id: i.id, checked: !!v })}
                      aria-label={i.item_name}
                    />
                    <span className={i.checked ? "flex-1 text-muted-foreground line-through" : "flex-1"}>
                      {i.item_name}
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatQuantity(i.quantity)} {i.unit ?? ""}
                    </span>
                    <button
                      type="button"
                      aria-label={`Poista ${i.item_name}`}
                      onClick={() => remove.mutate(i.id)}
                      className="text-muted-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => clear.mutate(true)}>
              Poista merkityt
            </Button>
            <Button variant="ghost" onClick={() => clear.mutate(false)}>
              Tyhjennä lista
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
