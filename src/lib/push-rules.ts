import { z } from "zod";
export const pushSchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(180),
  link: z.string().trim().max(500).optional().nullable().refine((value) => {
    if (!value) return true;
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }, { message: "Use uma rota interna ou um endereço HTTPS." }),
});
export function isStalePushToken(code: string | undefined) { return code === "UNREGISTERED"; }