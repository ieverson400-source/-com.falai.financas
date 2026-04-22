import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeWhatsAppPhone } from "@/lib/phone";

const InputSchema = z.object({
  phone: z.string().min(10).max(30),
});

export const saveWhatsAppPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const normalized = normalizeWhatsAppPhone(data.phone);
    if (!normalized) {
      throw new Error("Use um número válido com DDI, por exemplo +5511999999999.");
    }

    const { supabase, userId } = context;

    const { data: conflict, error: conflictError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("whatsapp_phone", normalized)
      .maybeSingle();

    if (conflictError) throw new Error(conflictError.message);
    if (conflict && conflict.user_id !== userId) {
      throw new Error("Esse número já está vinculado a outro cliente.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ whatsapp_phone: normalized })
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    return { whatsapp_phone: normalized };
  });