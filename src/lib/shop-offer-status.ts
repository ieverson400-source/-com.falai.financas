export function offerStatus(offer: { is_active: boolean; starts_at: string | null; ends_at: string | null }, now = Date.now()) {
  if (offer.ends_at && Date.parse(offer.ends_at) < now) return "Expirada";
  if (!offer.is_active) return "Pendente / pausada";
  if (offer.starts_at && Date.parse(offer.starts_at) > now) return "Agendada";
  return "Aprovada";
}