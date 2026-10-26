import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Sesión actual (solo para mostrar quién entró). El acceso real lo controla la base. */
export function useSession() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setEmail(session?.user.email ?? null);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return email;
}

/** Cerrar sesión sin dejar datos del panel en caché ni en el historial. */
export async function signOut(queryClient: QueryClient, navigate: (opts: { to: "/" | "/auth"; replace: boolean }) => Promise<void>) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
  await navigate({ to: "/auth", replace: true });
}
