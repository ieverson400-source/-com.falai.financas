// Sonda SOMENTE LEITURA do sandbox da Celcoin. Script isolado: não importa nada do app.
//
// Operações permitidas (lista fechada, verificada em tempo de execução):
//   POST /v5/token                                   (apenas autenticação OAuth 2.0)
//   GET  /v5/transactions/topups/providers           (operadoras)
//   GET  /v5/transactions/topups/provider-values     (valores)
//   GET  /baas/v2/topup/providers                    (operadoras, caminho alternativo do tutorial)
//   GET  /baas/v2/topup/provider-values              (valores, caminho alternativo do tutorial)
// Não existe aqui nenhuma recarga, cobrança PIX, PUT ou DELETE.
//
// Uso (PowerShell, na raiz do projeto):
//   node --env-file=.env.local scripts/celcoin-sandbox-probe.mjs            # consultas reais
//   node scripts/celcoin-sandbox-probe.mjs --dry-run                         # sem rede
//
// Variáveis lidas do ambiente local (nunca escritas no código nem exibidas):
//   CELCOIN_CLIENT_ID, CELCOIN_CLIENT_SECRET
// Opcional: CELCOIN_STATE_CODE (DDD, padrão 11).

const HOST = "sandbox.openfinance.celcoin.dev";
const BASE = `https://${HOST}`;
const TIMEOUT_MS = 20_000;

const ALLOWED = [
  { method: "POST", path: "/v5/token" },
  { method: "GET", path: "/v5/transactions/topups/providers" },
  { method: "GET", path: "/v5/transactions/topups/provider-values" },
  { method: "GET", path: "/baas/v2/topup/providers" },
  { method: "GET", path: "/baas/v2/topup/provider-values" },
];

const dryRun = process.argv.includes("--dry-run");
const SENSITIVE_KEY = /secret|token|authorization|password|senha|cpf|cnpj|document|phone|telefone|email|account|conta|pin|checksum|receipt/i;

const secrets = [process.env.CELCOIN_CLIENT_ID, process.env.CELCOIN_CLIENT_SECRET].filter(Boolean);

/** Remove qualquer ocorrência dos segredos e mascara chaves sensíveis. */
function sanitize(value, depth = 0) {
  if (depth > 6) return "[…]";
  if (typeof value === "string") {
    let s = value;
    for (const sec of secrets) s = s.split(sec).join("[redacted]");
    return s.length > 120 ? `${s.slice(0, 120)}…` : s;
  }
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? "[masked]" : sanitize(v, depth + 1);
    return out;
  }
  return value;
}

function print(label, data) {
  console.log(`\n=== ${label}`);
  console.log(typeof data === "string" ? data : JSON.stringify(sanitize(data), null, 2));
}

async function call(method, path, { query, form, multipart, token } = {}) {
  if (!ALLOWED.some((a) => a.method === method && a.path === path)) {
    throw new Error(`Operação não permitida: ${method} ${path}`);
  }
  const url = new URL(BASE + path);
  if (url.hostname !== HOST) throw new Error("Host não permitido");
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));

  const headers = { Accept: "application/json" };
  let body;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  }
  if (multipart) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(multipart)) fd.append(k, v);
    body = fd;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* corpo não JSON */
    }
    return { status: res.status, json, bytes: text.length };
  } catch (e) {
    return { status: 0, json: null, error: controller.signal.aborted ? "timeout" : "network error" };
  } finally {
    clearTimeout(timer);
  }
}

function describeShape(json) {
  if (Array.isArray(json)) return `array(${json.length})`;
  if (json && typeof json === "object") return `object{${Object.keys(json).join(",")}}`;
  return json === null ? "no JSON body" : typeof json;
}

async function authenticate() {
  const fields = {
    client_id: process.env.CELCOIN_CLIENT_ID,
    grant_type: "client_credentials",
    client_secret: process.env.CELCOIN_CLIENT_SECRET,
  };
  const attempts = [
    { name: "x-www-form-urlencoded", opts: { form: fields } },
    { name: "multipart/form-data", opts: { multipart: fields } },
  ];
  for (const a of attempts) {
    const r = await call("POST", "/v5/token", a.opts);
    const ok = r.status === 200 && typeof r.json?.access_token === "string";
    console.log(`token (${a.name}): HTTP ${r.status}${r.error ? ` ${r.error}` : ""}${ok ? " -> OK" : ""}` +
      (!ok && r.json?.errorCode ? ` errorCode=${r.json.errorCode}` : ""));
    if (ok) {
      return { token: r.json.access_token, contentType: a.name, expiresIn: r.json.expires_in, tokenType: r.json.token_type };
    }
  }
  return null;
}

async function main() {
  if (dryRun) {
    console.log("DRY RUN: nenhuma requisição será feita. Operações permitidas:");
    for (const a of ALLOWED) console.log(`  ${a.method} ${BASE}${a.path}`);
    return;
  }
  if (!process.env.CELCOIN_CLIENT_ID || !process.env.CELCOIN_CLIENT_SECRET) {
    console.error("Variáveis ausentes: CELCOIN_CLIENT_ID e/ou CELCOIN_CLIENT_SECRET. Nenhuma requisição feita.");
    process.exitCode = 2;
    return;
  }

  const stateCode = Number(process.env.CELCOIN_STATE_CODE ?? 11);
  const auth = await authenticate();
  if (!auth) {
    console.log("\nRESULTADO: autenticação FALHOU. Nenhuma consulta adicional foi feita.");
    process.exitCode = 1;
    return;
  }
  print("autenticação", { ok: true, contentType: auth.contentType, expires_in: auth.expiresIn, token_type: auth.tokenType });

  const styles = [
    { name: "v5", providers: "/v5/transactions/topups/providers", values: "/v5/transactions/topups/provider-values" },
    { name: "baas", providers: "/baas/v2/topup/providers", values: "/baas/v2/topup/provider-values" },
  ];

  for (const s of styles) {
    console.log(`\n##### caminho "${s.name}"`);
    const prov = await call("GET", s.providers, { token: auth.token, query: { stateCode, type: 0, category: 0 } });
    console.log(`GET ${s.providers}: HTTP ${prov.status}${prov.error ? ` ${prov.error}` : ""} shape=${describeShape(prov.json)}`);
    if (prov.json && prov.status !== 200) print("erro", { errorCode: prov.json.errorCode, message: prov.json.message });

    const list = Array.isArray(prov.json) ? prov.json : Array.isArray(prov.json?.providers) ? prov.json.providers : [];
    if (prov.status === 200) print(`operadoras (3 primeiras de ${list.length})`, list);

    // Escolhe uma operadora de telefone para consultar valores.
    const pick = list.find((p) => Number(p.category) === 1) ?? list[0];
    const providerId = pick?.providerId;
    if (providerId === undefined) {
      console.log("Sem providerId para consultar valores neste caminho.");
      continue;
    }
    const vals = await call("GET", s.values, { token: auth.token, query: { stateCode, providerId } });
    console.log(`GET ${s.values} (providerId=${providerId}): HTTP ${vals.status}${vals.error ? ` ${vals.error}` : ""} shape=${describeShape(vals.json)}`);
    if (vals.json && vals.status !== 200) print("erro", { errorCode: vals.json.errorCode, message: vals.json.message });
    if (vals.status === 200) {
      const items = Array.isArray(vals.json?.value) ? vals.json.value : [];
      print(`valores (3 primeiros de ${items.length})`, items);
      // Campos presentes, para identificar qual é o valor da recarga (sem mascarar nomes).
      const keys = new Set(items.flatMap((i) => Object.keys(i ?? {})));
      console.log(`campos presentes em cada item: ${[...keys].join(", ")}`);
    }
  }
  console.log("\nFim. Somente leituras foram feitas (além da autenticação).");
}

main();
