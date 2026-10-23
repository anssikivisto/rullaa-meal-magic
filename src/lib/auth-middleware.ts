import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const authMiddleware = createMiddleware({ type: "function" })
  // Selain: liitä kirjautumisen tunniste jokaiseen kutsuun
  .client(async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  })
  // Palvelin: tarkista tunniste Supabasesta
  .server(async ({ next }) => {
    const authHeader = getRequestHeader("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) throw new Error("Kirjaudu sisään käyttääksesi tekoälyä.");

    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Palvelimen asetukset puuttuvat.");

    const verifier = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data.user) {
      throw new Error("Istunto ei ole voimassa. Kirjaudu uudelleen.");
    }

    return next({ context: { userId: data.user.id } });
  });