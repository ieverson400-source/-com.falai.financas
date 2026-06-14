import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Throws if the given userId is not an admin in public.user_roles.
 * Use inside server functions that have already gone through requireSupabaseAuth.
 */
export async function assertAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Forbidden");
  if (!data) throw new Error("Forbidden");
}
