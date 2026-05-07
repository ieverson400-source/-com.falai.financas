import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractReceiptFromImage } from "@/server/receipt-ai";

const InputSchema = z.object({
  imageBase64: z.string().min(10).max(20_000_000),
  mimeType: z.string().min(3).max(100),
});

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10);
    const extracted = await extractReceiptFromImage({
      imageBase64: data.imageBase64,
      mimeType: data.mimeType,
      today,
    });
    return { extracted };
  });
