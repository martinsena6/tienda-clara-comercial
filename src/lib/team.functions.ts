// Funciones de servidor para gestionar el equipo. La service key solo vive acá, nunca en el navegador.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Invita a una persona por email. Solo puede llamarla un admin. */
export const inviteUser = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => {
    const email = String(d?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresá un email válido");
    return { email };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: ok, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !ok) throw new Error("Sin permiso");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = new URL(getRequest().url).origin;
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${origin}/auth` });
    if (error) throw error;
    return { invited: true };
  });
