import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { localStore, newId } from "./local-store";
import type { Ingredient, MealEntry, Recipe, ShoppingItem } from "./types";
import { aggregate, ingredientsToItems } from "./categorize";

type Ctx = { userId: string | null };

function toRecipe(row: Record<string, unknown>): Recipe {
  return {
    id: row['id'] as string,
    title: row['title'] as string,
    source_url: (row['source_url'] as string) ?? null,
    prep_time: (row['prep_time'] as number) ?? null,
    servings: (row['servings'] as number) ?? 4,
    ingredients: (row['ingredients'] as Ingredient[]) ?? [],
    instructions: (row['instructions'] as string[]) ?? [],
    tags: (row['tags'] as string[]) ?? [],
    image_url: (row['image_url'] as string) ?? null,
    notes: (row['notes'] as string) ?? null,
    created_at: row['created_at'] as string,
  };
}

/* ---------------- recipes ---------------- */

async function fetchRecipes({ userId }: Ctx): Promise<Recipe[]> {
  if (!userId) return localStore.recipes();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRecipe);
}

export type RecipeInput = Omit<Recipe, "id" | "created_at" | "image_url" | "notes"> & {
  id?: string;
  image_url?: string | null;
  notes?: string | null;
};

async function saveRecipe(ctx: Ctx, input: RecipeInput): Promise<Recipe> {
  if (!ctx.userId) {
    const all = localStore.recipes();
    if (input.id) {
      const updated = all.map((r) => (r.id === input.id ? { ...r, ...input, id: r.id } : r));
      localStore.setRecipes(updated);
      return updated.find((r) => r.id === input.id)!;
    }
    const recipe: Recipe = {
      ...input,
      image_url: input.image_url ?? null,
      notes: input.notes ?? null,
      id: newId(),
      created_at: new Date().toISOString(),
    };
    localStore.setRecipes([recipe, ...all]);
    return recipe;
  }
  const payload = {
    user_id: ctx.userId,
    title: input.title,
    source_url: input.source_url,
    prep_time: input.prep_time,
    servings: input.servings,
    ingredients: input.ingredients as unknown as never,
    instructions: input.instructions,
    tags: input.tags,
    image_url: input.image_url ?? null,
    notes: input.notes ?? null,
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("recipes")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return toRecipe(data);
  }
  const { data, error } = await supabase.from("recipes").insert(payload).select().single();
  if (error) throw error;
  return toRecipe(data);
}

async function deleteRecipe(ctx: Ctx, id: string) {
  if (!ctx.userId) {
    localStore.setRecipes(localStore.recipes().filter((r) => r.id !== id));
    localStore.setPlan(localStore.plan().filter((p) => p.recipe_id !== id));
    return;
  }
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

export function useRecipes() {
  const { userId, loading } = useAuth();
  return useQuery({
    queryKey: ["recipes", userId],
    queryFn: () => fetchRecipes({ userId }),
    enabled: !loading,
  });
}

export function useSaveRecipe() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => saveRecipe({ userId }, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useDeleteRecipe() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecipe({ userId }, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

/* ---------------- meal plan ---------------- */

async function fetchPlan({ userId }: Ctx): Promise<MealEntry[]> {
  if (!userId) return localStore.plan();
  const { data, error } = await supabase.from("meal_plan").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    recipe_id: r.recipe_id,
    meal_type: r.meal_type,
    status: (r as { status: string | null }).status ?? null,
    position: (r as { position: number | null }).position ?? 0,
  }));
}

export type SlotInput = {
  id?: string;
  date: string;
  meal_type: string;
  recipe_id?: string | null;
  status?: string | null;
  position?: number;
};

async function upsertSlot(ctx: Ctx, slot: SlotInput) {
  if (!ctx.userId) {
    const plan = localStore.plan();
    if (slot.id) {
      localStore.setPlan(
        plan.map((p) =>
          p.id === slot.id
            ? {
                ...p,
                meal_type: slot.meal_type,
                recipe_id: slot.recipe_id ?? null,
                status: slot.status ?? null,
              }
            : p,
        ),
      );
      return;
    }
    localStore.setPlan([
      ...plan,
      {
        id: newId(),
        date: slot.date,
        meal_type: slot.meal_type,
        recipe_id: slot.recipe_id ?? null,
        status: slot.status ?? null,
        position: slot.position ?? plan.filter((p) => p.date === slot.date).length,
      },
    ]);
    return;
  }
  if (slot.id) {
    const { error } = await supabase
      .from("meal_plan")
      .update({
        meal_type: slot.meal_type,
        recipe_id: slot.recipe_id ?? null,
        status: slot.status ?? null,
      })
      .eq("id", slot.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("meal_plan").insert({
    user_id: ctx.userId,
    date: slot.date,
    meal_type: slot.meal_type,
    recipe_id: slot.recipe_id ?? null,
    status: slot.status ?? null,
    position: slot.position ?? 0,
  });
  if (error) throw error;
}

async function removeSlot(ctx: Ctx, id: string) {
  if (!ctx.userId) {
    localStore.setPlan(localStore.plan().filter((p) => p.id !== id));
    return;
  }
  const { error } = await supabase.from("meal_plan").delete().eq("id", id);
  if (error) throw error;
}

async function ensureWeekSlots(ctx: Ctx, dates: string[], defaults: readonly string[]) {
  const existing = await fetchPlan(ctx);
  const missing = dates.filter((d) => !existing.some((p) => p.date === d));
  if (!missing.length) return false;
  for (const date of missing) {
    for (let i = 0; i < defaults.length; i++) {
      await upsertSlot(ctx, { date, meal_type: defaults[i]!, position: i });
    }
  }
  return true;
}

export function usePlan() {
  const { userId, loading } = useAuth();
  return useQuery({
    queryKey: ["plan", userId],
    queryFn: () => fetchPlan({ userId }),
    enabled: !loading,
  });
}

export function usePlanActions() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["plan"] });

  const setSlot = useMutation({
    mutationFn: (slot: SlotInput) => upsertSlot({ userId }, slot),
    onSuccess: invalidate,
  });
  const addSlot = useMutation({
    mutationFn: (slot: SlotInput) => upsertSlot({ userId }, slot),
    onSuccess: invalidate,
  });
  const deleteSlot = useMutation({
    mutationFn: (id: string) => removeSlot({ userId }, id),
    onSuccess: invalidate,
  });
  const ensureWeek = useMutation({
    mutationFn: ({ dates, defaults }: { dates: string[]; defaults: readonly string[] }) =>
      ensureWeekSlots({ userId }, dates, defaults),
    onSuccess: (changed) => {
      if (changed) invalidate();
    },
  });

  return { setSlot, addSlot, deleteSlot, ensureWeek };
}

/* ---------------- shopping list ---------------- */

async function fetchList({ userId }: Ctx): Promise<ShoppingItem[]> {
  if (!userId) return localStore.list();
  const { data, error } = await supabase
    .from("shopping_list")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    item_name: r.item_name,
    quantity: r.quantity == null ? null : Number(r.quantity),
    unit: r.unit,
    category: r.category,
    checked: r.checked,
    recipe_id: r.recipe_id,
    created_at: r.created_at,
  }));
}

async function addItems(
  ctx: Ctx,
  newOnes: { item_name: string; quantity: number | null; unit: string | null; category: string; recipe_id: string | null }[],
) {
  const existing = await fetchList(ctx);
  const merged = aggregate([
    ...existing.map((e) => ({
      item_name: e.item_name,
      quantity: e.quantity,
      unit: e.unit,
      category: e.category,
      recipe_id: e.recipe_id,
    })),
    ...newOnes,
  ]);
  // Keep checked state for untouched items
  const checkedMap = new Map(existing.map((e) => [e.item_name.toLowerCase(), e.checked]));

  if (!ctx.userId) {
    localStore.setList(
      merged.map((m) => ({
        id: newId(),
        item_name: m.item_name,
        quantity: m.quantity,
        unit: m.unit,
        category: m.category,
        checked: false,
        recipe_id: m.recipe_id,
        created_at: new Date().toISOString(),
      })),
    );
    return;
  }
  await supabase.from("shopping_list").delete().not("id", "is", null);
  const { error } = await supabase.from("shopping_list").insert(
    merged.map((m) => ({
      user_id: ctx.userId!,
      item_name: m.item_name,
      quantity: m.quantity,
      unit: m.unit,
      category: m.category,
      checked: checkedMap.get(m.item_name.toLowerCase()) ?? false,
      recipe_id: m.recipe_id,
    })),
  );
  if (error) throw error;
}

async function toggleItem(ctx: Ctx, id: string, checked: boolean) {
  if (!ctx.userId) {
    localStore.setList(localStore.list().map((i) => (i.id === id ? { ...i, checked } : i)));
    return;
  }
  const { error } = await supabase.from("shopping_list").update({ checked }).eq("id", id);
  if (error) throw error;
}

async function removeItem(ctx: Ctx, id: string) {
  if (!ctx.userId) {
    localStore.setList(localStore.list().filter((i) => i.id !== id));
    return;
  }
  const { error } = await supabase.from("shopping_list").delete().eq("id", id);
  if (error) throw error;
}

async function clearList(ctx: Ctx, onlyChecked: boolean) {
  if (!ctx.userId) {
    localStore.setList(onlyChecked ? localStore.list().filter((i) => !i.checked) : []);
    return;
  }
  let q = supabase.from("shopping_list").delete();
  q = onlyChecked ? q.eq("checked", true) : q.not("id", "is", null);
  const { error } = await q;
  if (error) throw error;
}

export function useShoppingList() {
  const { userId, loading } = useAuth();
  return useQuery({
    queryKey: ["list", userId],
    queryFn: () => fetchList({ userId }),
    enabled: !loading,
  });
}

export function useShoppingActions() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["list"] });

  const addRecipes = useMutation({
    mutationFn: async (entries: { recipe: Recipe; factor?: number }[]) => {
      const items = entries.flatMap((e) =>
        ingredientsToItems(e.recipe.ingredients, e.recipe.id, e.factor ?? 1),
      );
      await addItems({ userId }, items);
    },
    onSuccess: invalidate,
  });

  const addManual = useMutation({
    mutationFn: async (item: { item_name: string; quantity: number | null; unit: string | null; category: string }) =>
      addItems({ userId }, [{ ...item, recipe_id: null }]),
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      toggleItem({ userId }, id, checked),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeItem({ userId }, id),
    onSuccess: invalidate,
  });

  const clear = useMutation({
    mutationFn: (onlyChecked: boolean) => clearList({ userId }, onlyChecked),
    onSuccess: invalidate,
  });

  return { addRecipes, addManual, toggle, remove, clear };
}

/* ---------------- guest -> account migration ---------------- */

export async function migrateGuestData(userId: string) {
  const recipes = localStore.recipes();
  const plan = localStore.plan();
  const list = localStore.list();
  if (!recipes.length && !plan.length && !list.length) return false;

  const idMap = new Map<string, string>();
  for (const r of recipes) {
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        user_id: userId,
        title: r.title,
        source_url: r.source_url,
        prep_time: r.prep_time,
        servings: r.servings,
        ingredients: r.ingredients as unknown as never,
        instructions: r.instructions,
        tags: r.tags,
        image_url: r.image_url ?? null,
      })
      .select("id")
      .single();
    if (!error && data) idMap.set(r.id, data.id);
  }
  if (plan.length) {
    await supabase.from("meal_plan").insert(
      plan
        .filter((p) => p.recipe_id && idMap.has(p.recipe_id))
        .map((p) => ({
          user_id: userId,
          date: p.date,
          recipe_id: idMap.get(p.recipe_id!)!,
          meal_type: p.meal_type,
        })),
    );
  }
  if (list.length) {
    await supabase.from("shopping_list").insert(
      list.map((i) => ({
        user_id: userId,
        item_name: i.item_name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
        checked: i.checked,
        recipe_id: i.recipe_id && idMap.has(i.recipe_id) ? idMap.get(i.recipe_id)! : null,
      })),
    );
  }
  localStore.clear();
  return true;
}
