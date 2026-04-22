export function normalizeWhatsAppPhone(value: string) {
  const trimmed = value.trim().replace(/^whatsapp:/i, "");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return `+${digits}`;
}

export function formatWhatsAppPhone(value: string | null | undefined) {
  if (!value) return "Não configurado";
  return value.startsWith("+") ? value : `+${value}`;
}