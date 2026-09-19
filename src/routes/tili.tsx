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
      { title: "Tili – Rullaa" },
      {
        name: "description",
        content: "Kirjaudu Rullaan Googlella tai sähköpostilla ja siirrä vieraskäytön reseptit.",
      },
      { property: "og:title", content: "Tili – Rullaa" },
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
    if (window.localStorage.getItem("rullaa.profile.asked")) return;
    window.localStorage.setItem("rullaa.profile.asked", "1");
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
      <h1 className="font-display text-3xl">Tili</h1>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
      ) : user ? (
        <div className="card-soft mt-4 space-y-4 px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Kirjautuneena</p>
            <p className="font-display text-xl">{user.email ?? "Tili"}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => void runMigrate()} disabled={migrating}>
            {migrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Siirrä vieraskäytön tiedot tilille
          </Button>
          <Button
            variant="ghost"
            className="w-full"
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
        <div className="card-soft mt-4 space-y-4 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Käytät Rullaa vieraana – reseptit tallentuvat vain tähän laitteeseen. Kirjaudu, niin
            saat ne kaikkiin laitteisiisi.
          </p>
          <Button className="w-full" onClick={() => void google()} disabled={busy}>
            Jatka Googlella
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="email">Sähköposti</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="etunimi@esimerkki.fi"
            />
          </div>
          <Button variant="outline" className="w-full" onClick={() => void magicLink()} disabled={busy}>
            <Mail className="mr-2 h-4 w-4" /> Lähetä kirjautumislinkki
          </Button>
          {isGuest && (
            <p className="text-xs text-muted-foreground">
              Kirjautumisen jälkeen voit siirtää vieraskäytön reseptit tilillesi yhdellä
              napautuksella.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}
