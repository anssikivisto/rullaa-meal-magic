import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Loader2, LogOut, Mail, Sparkles, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TasteProfileDialog } from "@/components/TasteProfileDialog";
import { migrateGuestData, useTasteProfile } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/tili")({
  head: () => ({
    meta: [
      { title: "Tili – Tilli" },
      {
        name: "description",
        content: "Kirjaudu Tilliin Googlella tai sähköpostilla ja siirrä vieraskäytön reseptit.",
      },
      { property: "og:title", content: "Tili – Tilli" },
      { property: "og:description", content: "Kirjaudu sisään ja synkronoi reseptisi." },
    ],
  }),
  component: Tili,
});

function ListRow({
  icon,
  label,
  onClick,
  busy,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50 disabled:opacity-60"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-[15px]">{label}</span>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </li>
  );
}

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
    if (window.localStorage.getItem("tilli.profile.asked")) return;
    window.localStorage.setItem("tilli.profile.asked", "1");
    setAsked(true);
    setProfileOpen(true);
  }, [profileLoading, profile, asked]);

  const meta = (user?.user_metadata ?? {}) as {
    avatar_url?: string;
    picture?: string;
    full_name?: string;
    name?: string;
  };
  const avatar = meta.avatar_url ?? meta.picture ?? null;
  const displayName = meta.full_name ?? meta.name ?? user?.email ?? "Tili";

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

  async function signOut() {
    await supabase.auth.signOut();
    await qc.invalidateQueries();
    toast.success("Kirjauduit ulos.");
  }

  const hasPrefs = !!profile && (profile.tags.length > 0 || !!profile.default_servings);

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl">Tili</h1>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
      ) : user ? (
        <section className="card-soft flex items-center gap-4 p-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-secondary">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-xl text-primary">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight">{displayName}</p>
            {user.email && displayName !== user.email && (
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            )}
          </div>
        </section>
      ) : (
        <section className="card-soft space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            Käytät Tilliä vieraana – reseptit tallentuvat vain tähän laitteeseen. Kirjaudu, niin
            saat ne kaikkiin laitteisiisi.
          </p>
          <Button
            className="h-11 w-full rounded-[14px]"
            onClick={() => void google()}
            disabled={busy}
          >
            Jatka Googlella
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">tai</span>
            </div>
          </div>

          <div className="space-y-2">
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
          <Button
            variant="outline"
            className="h-11 w-full rounded-[14px]"
            onClick={() => void magicLink()}
            disabled={busy}
          >
            <Mail className="mr-2 h-4 w-4" /> Lähetä kirjautumislinkki
          </Button>
          {isGuest && (
            <p className="px-2 text-center text-xs text-muted-foreground">
              Kirjautumisen jälkeen voit siirtää vieraskäytön reseptit tilillesi yhdellä
              napautuksella.
            </p>
          )}
        </section>
      )}

      {/* Makuprofiili */}
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="card-soft mt-4 flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Sparkles className="h-5 w-5 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Makuprofiili</span>
          <span className="line-clamp-2 block text-sm text-muted-foreground">
            {profile?.summary ?? "Auta Tilliä ehdottamaan sinulle sopivampia reseptejä."}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>

      {/* Mieltymykset */}
      <h2 className="mb-3 mt-7 text-xl">Mieltymykset</h2>
      {hasPrefs ? (
        <div className="flex flex-wrap gap-2">
          {profile?.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-tag-diet px-3.5 py-1.5 text-sm font-medium text-tag-diet-foreground"
            >
              {t}
            </span>
          ))}
          {profile?.default_servings ? (
            <span className="rounded-full bg-tag-time px-3.5 py-1.5 text-sm font-medium text-tag-time-foreground">
              {profile.default_servings} annosta
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Et ole vielä täyttänyt makuprofiilia.</p>
      )}
      {profile?.dislikes && (
        <p className="mt-3 text-sm text-muted-foreground">Vältettävät: {profile.dislikes}</p>
      )}

      {/* Toiminnot */}
      {user && (
        <ul className="card-soft mt-7 divide-y divide-border/60 overflow-hidden">
          <ListRow
            icon={<Upload className="h-5 w-5" />}
            label="Siirrä vieraskäytön tiedot tilille"
            onClick={() => void runMigrate()}
            busy={migrating}
          />
          <ListRow
            icon={<LogOut className="h-5 w-5" />}
            label="Kirjaudu ulos"
            onClick={() => void signOut()}
          />
        </ul>
      )}

      <TasteProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </AppShell>
  );
}