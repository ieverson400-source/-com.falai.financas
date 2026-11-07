// Limite de uso por usuário (janela deslizante em memória). Código puro.
// Em ambiente de funções serverless a memória é por instância: o limite é uma proteção de melhor esforço
// contra abuso e custo, não uma garantia exata.

export interface RateLimiter {
  check(key: string): { allowed: boolean; retryAfterMs: number };
}

export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 5000;

  return {
    check(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((ts) => t - ts < opts.windowMs);
      if (recent.length >= opts.limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: Math.max(0, opts.windowMs - (t - recent[0])) };
      }
      recent.push(t);
      hits.set(key, recent);
      // Evita crescimento sem limite: descarta as chaves mais antigas.
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}
