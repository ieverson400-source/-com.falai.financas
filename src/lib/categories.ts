export const CATEGORIES = [
  "Conta de luz",
  "Internet",
  "Água",
  "Aluguel",
  "Supermercado",
  "Restaurante",
  "Transporte",
  "Combustível",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Outros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const categoryColor = (cat: string): string => {
  const idx = CATEGORIES.indexOf(cat as Category);
  const palette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
  ];
  return palette[(idx >= 0 ? idx : 12) % palette.length];
};

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
