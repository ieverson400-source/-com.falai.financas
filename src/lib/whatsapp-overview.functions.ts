import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface MappingRow {
  user_id: string;
  display_name: string | null;
  whatsapp_phone: string;
}

export interface ConflictGroup {
  phone: string;
  profiles: MappingRow[];
}

export interface UnmappedRow {
  id: string;
  from_phone: string;
  hits: number;
  first_seen_at: string;
  last_seen_at: string;
  last_message_sid: string | null;
}

export interface WhatsAppOverview {
  mappings: MappingRow[];
  conflicts: ConflictGroup[];
  unmapped: UnmappedRow[];
}

export const getWhatsAppOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WhatsAppOverview> => {
    // Use admin para enxergar todos os perfis (visão de administração)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, whatsapp_phone")
      .not("whatsapp_phone", "is", null);

    if (profilesError) throw new Error(profilesError.message);

    const mappings: MappingRow[] = (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      whatsapp_phone: p.whatsapp_phone as string,
    }));

    // Agrupa por telefone para detectar conflitos (mesmo número em mais de um perfil)
    const grouped = new Map<string, MappingRow[]>();
    for (const m of mappings) {
      const list = grouped.get(m.whatsapp_phone) ?? [];
      list.push(m);
      grouped.set(m.whatsapp_phone, list);
    }
    const conflicts: ConflictGroup[] = [];
    for (const [phone, list] of grouped.entries()) {
      if (list.length > 1) conflicts.push({ phone, profiles: list });
    }

    const { data: unmappedData, error: unmappedError } = await supabaseAdmin
      .from("whatsapp_unmapped_numbers")
      .select("id, from_phone, hits, first_seen_at, last_seen_at, last_message_sid")
      .order("last_seen_at", { ascending: false })
      .limit(50);

    if (unmappedError) throw new Error(unmappedError.message);

    return {
      mappings: mappings.sort((a, b) =>
        (a.display_name ?? "").localeCompare(b.display_name ?? ""),
      ),
      conflicts,
      unmapped: (unmappedData ?? []) as UnmappedRow[],
    };
  });
