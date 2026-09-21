import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Mail, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TasteProfileDialog } from "@/components/TasteProfileDialog";
import { useTasteProfile } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { migrateGuestData } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/tili")({
  head: () => ({
    meta: [
      { title: "Tili – Oiva" },
      {
        name: "description",
        content: "Kirjaudu Oivaan Googlella tai sähköpostilla ja siirrä vieraskäytön reseptit.",
      },
      { property: "og:title", content: "Tili – Oiva" },
      { property: "og:description", content: "Kirjaudu sisään ja synkronoi reseptisi." },
    ],
  }),
  component: Tili,
});

function Tili() {
  const { user, loading, isGuest } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const qc = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useTasteProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [asked, setAsked] = useState(false);

  // Kysy makuprofiili kerran, jos sitä ei vielä ole.
  useEffect(() => {
    if (profileLoading || asked || profile) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("oiva.profile.asked")) return;
    window.localStorage.setItem("oiva.profile.asked", "1");
    setAsked(true);
    setProfileOpen(true);
  }, [profileLoading, profile, asked]);

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/tili` },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  async function magicLink() {
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: `${window.location.origin}/tili` },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Lähetimme kirjautumislinkin sähköpostiisi.");
  }

  async function runMigrate() {
    if (!user) return;
    setMigrating(true);
    try {
      const moved = await migrateGuestData(user.id);
      await qc.invalidateQueries();
      toast.success(moved ? "Vieraskäytön tiedot siirretty tilillesi." : "Ei siirrettäviä tietoja.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Siirto epäonnistui.");
    } finally {
      setMigrating(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-stone-800">Tili</h1>

      {loading ? (
        <p className="py-12 text-center text-sm text-stone-500">Ladataan…</p>
      ) : user ? (
        <div className="bg-stone-50 rounded-2xl border border-stone-200/60 mt-4 space-y-4 px-5 py-5 shadow-sm">
          <div>
            <p className="text-sm text-stone-500 mb-1">Kirjautuneena</p>
            <p className="font-display text-xl text-stone-800">{user.email ?? "Tili"}</p>
          </div>
          <Button variant="outline" className="w-full rounded-2xl border-stone-300 text-stone-700 hover:bg-stone-100" onClick={() => void runMigrate()} disabled={migrating}>
            {migrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Siirrä vieraskäytön tiedot tilille
          </Button>
          <Button
            variant="ghost"
            className="w-full rounded-2xl text-stone-500 hover:text-stone-800 hover:bg-stone-200/50"
            onClick={async () => {
              await supabase.auth.signOut();
              await qc.invalidateQueries();
              toast.success("Kirjauduit ulos.");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Kirjaudu ulos
          </Button>
        </div>
      ) : (
        <div className="bg-stone-50 rounded-2xl border border-stone-200/60 mt-4 space-y-5 px-5 py-5 shadow-sm">
          <p className="text-sm text-stone-600">
            Käytät Oivaa vieraana – reseptit tallentuvat vain tähän laitteeseen. Kirjaudu, niin
            saat ne kaikkiin laitteisiisi.
          </p>
          <Button className="w-full rounded-2xl bg-stone-800 hover:bg-stone-900 text-white" onClick={() => void google()} disabled={busy}>
            Jatka Googlella
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-stone-50 px-2 text-stone-500">tai</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-stone-700">Sähköposti</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              className="rounded-xl border-stone-200 bg-white focus-visible:ring-emerald-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="etunimi@esimerkki.fi"
            />
          </div>
          <Button variant="outline" className="w-full rounded-2xl border-stone-300 text-stone-700 hover:bg-white" onClick={() => void magicLink()} disabled={busy}>
            <Mail className="mr-2 h-4 w-4" /> Lähetä kirjautumislinkki
          </Button>
          {isGuest && (
            <p className="text-xs text-stone-500 text-center px-2">
              Kirjautumisen jälkeen voit siirtää vieraskäytön reseptit tilillesi yhdellä napautuksella.
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm mt-5 space-y-4 px-5 py-5">
        <div>
          <p className="font-display text-xl text-stone-800">Makuprofiili</p>
          <p className="text-sm text-stone-500 mt-1">
            AI-apuri ehdottaa reseptejä ja viikon ruokalistan makusi mukaan.
          </p>
        </div>

        {profile?.summary && <p className="text-sm text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">{profile.summary}</p>}

        {profile?.tags?.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {profile.tags.map((t) => (
              <span
                key={t}
                className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-100/50"
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-400 italic">Et ole vielä täyttänyt makuprofiilia.</p>
        )}

        <Button className="w-full rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 mt-2" variant="outline" onClick={() => setProfileOpen(true)}>
          <Sparkles className="mr-2 h-4 w-4" />
          {profile ? "Muokkaa makuprofiilia" : "Luo makuprofiili"}
        </Button>
      </div>

      <TasteProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </AppShell>
  );
}