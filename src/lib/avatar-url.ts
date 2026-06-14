import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a stored avatar reference to a URL the browser can render.
 *
 * Accepts either:
 *  - a storage path inside the private `avatars` bucket (e.g. `userId/avatar-123.jpg`)
 *  - a legacy public URL (returned as-is for backwards compatibility — will likely 404
 *    now that the bucket is private; UI falls back to initials)
 *
 * Returns null when nothing is available.
 */
export async function resolveAvatarUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) {
    // Legacy entry stored as a public URL. Try to recover the storage path.
    const match = stored.match(/\/avatars\/(.+)$/);
    if (!match) return stored;
    const path = match[1].split("?")[0];
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }
  const { data } = await supabase.storage.from("avatars").createSignedUrl(stored, 60 * 60);
  return data?.signedUrl ?? null;
}
