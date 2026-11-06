// SERVER-ONLY. Configuração da Celcoin lida de variáveis de ambiente do servidor.
// Nunca importar deste arquivo em componentes, rotas de página ou hooks (o sufixo
// .server.ts faz o bundler do TanStack Start bloquear o import no cliente).
// Nunca usar variáveis com prefixo VITE_: elas vão para o bundle do navegador.

export const CELCOIN_SANDBOX_BASE_URL = "https://sandbox.openfinance.celcoin.dev";

export type CelcoinEnvironment = "sandbox" | "production";
/** UNCONFIRMED: a documentação diverge (multipart no OpenAPI, urlencoded na descrição). */
export type TokenContentType = "urlencoded" | "multipart";
/**
 * UNCONFIRMED: operadoras/valores aparecem em dois caminhos diferentes na documentação.
 *  - "v5":   /v5/transactions/topups/providers   (páginas de referência, mesmo host do /baas/v2/topup)
 *  - "baas": /baas/v2/topup/providers            (tutorial, host sandbox.celcoin.com.br)
 * Só o sandbox com credenciais da conta resolve. Não há valor padrão confirmado.
 */
export type ProvidersPathStyle = "v5" | "baas";

export interface CelcoinConfig {
  environment: CelcoinEnvironment;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Conta BaaS que realiza a recarga (campo `account`, máx. 20 caracteres - ITBE017). */
  account: string;
  timeoutMs: number;
  tokenContentType: TokenContentType;
  providersPathStyle: ProvidersPathStyle;
}

export class CelcoinConfigError extends Error {
  readonly missing: string[];
  constructor(message: string, missing: string[] = []) {
    super(message);
    this.name = "CelcoinConfigError";
    this.missing = missing;
  }
}

type Env = Record<string, string | undefined>;

const REQUIRED = ["CELCOIN_CLIENT_ID", "CELCOIN_CLIENT_SECRET", "CELCOIN_ACCOUNT"] as const;

/**
 * Lê e valida a configuração. As mensagens de erro citam só NOMES de variáveis,
 * nunca valores. O parâmetro `env` permite testar sem tocar em process.env.
 */
export function loadCelcoinConfig(env: Env = process.env): CelcoinConfig {
  const missing = REQUIRED.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new CelcoinConfigError(`Missing Celcoin environment variables: ${missing.join(", ")}`, [...missing]);
  }

  const environment: CelcoinEnvironment = env.CELCOIN_ENV?.trim() === "production" ? "production" : "sandbox";
  if (env.CELCOIN_ENV && !["sandbox", "production"].includes(env.CELCOIN_ENV.trim())) {
    throw new CelcoinConfigError("CELCOIN_ENV must be 'sandbox' or 'production'");
  }

  let baseUrl = env.CELCOIN_BASE_URL?.trim() || "";
  if (environment === "production") {
    // Produção só com opt-in explícito e URL informada (a URL de produção não está confirmada).
    if (env.CELCOIN_ALLOW_PRODUCTION !== "true") {
      throw new CelcoinConfigError("Production is disabled: set CELCOIN_ALLOW_PRODUCTION=true explicitly");
    }
    if (!baseUrl) throw new CelcoinConfigError("CELCOIN_BASE_URL is required in production", ["CELCOIN_BASE_URL"]);
  } else if (!baseUrl) {
    baseUrl = CELCOIN_SANDBOX_BASE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new CelcoinConfigError("CELCOIN_BASE_URL is not a valid URL");
  }
  if (parsed.protocol !== "https:") throw new CelcoinConfigError("CELCOIN_BASE_URL must use https");
  if (environment === "sandbox" && !parsed.hostname.includes("sandbox")) {
    throw new CelcoinConfigError("Sandbox environment requires a sandbox host in CELCOIN_BASE_URL");
  }
  if (environment === "production" && parsed.hostname.includes("sandbox")) {
    throw new CelcoinConfigError("Production environment cannot use a sandbox host");
  }

  const account = env.CELCOIN_ACCOUNT!.trim();
  if (account.length > 20) throw new CelcoinConfigError("CELCOIN_ACCOUNT exceeds 20 characters");

  const timeoutRaw = Number(env.CELCOIN_TIMEOUT_MS ?? 15000);
  const timeoutMs = Number.isFinite(timeoutRaw) ? Math.min(60000, Math.max(1000, Math.trunc(timeoutRaw))) : 15000;

  const tokenContentType = env.CELCOIN_TOKEN_CONTENT_TYPE?.trim() === "multipart" ? "multipart" : "urlencoded";
  const providersPathStyle = env.CELCOIN_PROVIDERS_PATH_STYLE?.trim() === "baas" ? "baas" : "v5";

  return {
    environment,
    baseUrl: `${parsed.origin}`,
    clientId: env.CELCOIN_CLIENT_ID!.trim(),
    clientSecret: env.CELCOIN_CLIENT_SECRET!.trim(),
    account,
    timeoutMs,
    tokenContentType,
    providersPathStyle,
  };
}

/** Versão segura para logs: segredos mascarados. */
export function describeConfig(config: CelcoinConfig): Record<string, string | number> {
  return {
    environment: config.environment,
    baseUrl: config.baseUrl,
    clientId: "[redacted]",
    clientSecret: "[redacted]",
    account: `***${config.account.slice(-3)}`,
    timeoutMs: config.timeoutMs,
    tokenContentType: config.tokenContentType,
    providersPathStyle: config.providersPathStyle,
  };
}
