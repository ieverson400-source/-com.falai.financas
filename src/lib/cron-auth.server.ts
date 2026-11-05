// Verifies scheduled-job callers using a private secret stored server-side only.
export async function isAuthorizedCron(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-cron-secret");
  if (!provided || provided.length < 32) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("internal_secrets")
    .select("value")
    .eq("name", "cron")
    .maybeSingle();
  if (!data?.value || data.value.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ data.value.charCodeAt(i);
  return diff === 0;
}
