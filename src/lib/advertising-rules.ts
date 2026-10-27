import { z } from "zod";

export const placements = ["SHOP_TOP", "SHOP_MIDDLE", "SHOP_OFFERS", "SHOP_BOTTOM"] as const;
export const companyStatuses = ["pending", "active", "paused", "rejected"] as const;
export const adStatuses = ["draft", "pending", "active", "paused", "expired", "rejected"] as const;
const webUrl = z.string().trim().max(2000).url().refine((s) => /^https?:\/\//.test(s), "Use um endereço HTTP ou HTTPS.");
const optionalUrl = webUrl.or(z.literal("")).nullable().optional();
export const advertiserSchema = z.object({
  id: z.string().uuid().optional(), company_name: z.string().trim().min(1).max(160),
  logo_url: optionalUrl, website_url: optionalUrl, description: z.string().max(2000).nullable().optional(),
  contact_email: z.string().email().or(z.literal("")).nullable().optional(), contact_phone: z.string().max(40).nullable().optional(),
  status: z.enum(companyStatuses),
});
export const advertisementSchema = z.object({
  id: z.string().uuid().optional(), advertiser_id: z.string().uuid(), title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).nullable().optional(), image_url: optionalUrl, logo_url: optionalUrl,
  destination_url: webUrl, category: z.string().max(80).nullable().optional(), offer_text: z.string().max(120).nullable().optional(),
  badge_text: z.string().max(160).nullable().optional(), placement: z.enum(placements),
  start_date: z.string().datetime().nullable(), end_date: z.string().datetime().nullable(), status: z.enum(adStatuses),
  is_sponsored: z.boolean(), is_featured: z.boolean(), priority: z.number().int().min(0).max(999), sort_order: z.number().int().min(0).max(999),
}).refine((a) => !a.start_date || !a.end_date || a.end_date >= a.start_date, { message: "A validade deve ser posterior ao início.", path: ["end_date"] });
export function isLiveAd(ad: { status: string; start_date: string | null; end_date: string | null }, now = Date.now()) {
  return ad.status === "active" && (!ad.start_date || Date.parse(ad.start_date) <= now) && (!ad.end_date || Date.parse(ad.end_date) >= now);
}
export function ctr(clicks: number, impressions: number) { return impressions ? clicks / impressions * 100 : 0; }