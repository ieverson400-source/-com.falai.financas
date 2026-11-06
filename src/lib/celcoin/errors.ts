// Classificação dos códigos de erro documentados da recarga BaaS v2 (tabela ITBE do tutorial
// "Realizar uma recarga"). Código puro. Códigos fora da tabela são "unrecognized".

export type TopupErrorClass =
  | "duplicate" //     o clientRequestId já existe: CONSULTAR, nunca tratar como falha
  | "not_found" //     identificador sem registro (consulta)
  | "validation" //    requisição inválida: a recarga NÃO foi criada
  | "configuration" // conta inexistente/inativa: problema nosso, não do usuário
  | "unrecognized";

const DUPLICATE = new Set(["ITBE011"]);
const NOT_FOUND = new Set(["ITBE002", "ITBE029"]);
const CONFIGURATION = new Set(["ITBE020"]);
const VALIDATION = new Set([
  "ITBE001", // transactionId/clientRequestId (obs.: o exemplo da doc usa ITBE001 para 'account' ausente)
  "ITBE003",
  "ITBE005",
  "ITBE006",
  "ITBE007",
  "ITBE008",
  "ITBE012",
  "ITBE013",
  "ITBE014",
  "ITBE017",
  "ITBE018",
  "ITBE019",
  "ITBE021",
  "ITBE022",
  "ITBE024",
  "ITBE025",
  "ITBE028",
  "ITBE045",
]);

export function classifyTopupErrorCode(code: string | null | undefined): TopupErrorClass {
  if (!code) return "unrecognized";
  const c = code.trim().toUpperCase();
  if (DUPLICATE.has(c)) return "duplicate";
  if (NOT_FOUND.has(c)) return "not_found";
  if (CONFIGURATION.has(c)) return "configuration";
  if (VALIDATION.has(c)) return "validation";
  return "unrecognized";
}

/** Falha ao obter o token (nada foi enviado ao endpoint de recarga). */
export class CelcoinTokenError extends Error {
  readonly httpStatus: number | null;
  readonly code: string | null;
  constructor(message: string, httpStatus: number | null = null, code: string | null = null) {
    super(message);
    this.name = "CelcoinTokenError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

/** Falha de transporte durante uma chamada já autenticada: o resultado pode ser desconhecido. */
export class CelcoinNetworkError extends Error {
  readonly kind: "timeout" | "network";
  constructor(kind: "timeout" | "network") {
    super(`Celcoin request failed: ${kind}`);
    this.name = "CelcoinNetworkError";
    this.kind = kind;
  }
}

/** Resposta HTTP inesperada em uma consulta somente leitura. */
export class CelcoinHttpError extends Error {
  readonly httpStatus: number;
  readonly code: string | null;
  constructor(httpStatus: number, code: string | null) {
    super(`Celcoin responded with HTTP ${httpStatus}${code ? ` (${code})` : ""}`);
    this.name = "CelcoinHttpError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}
