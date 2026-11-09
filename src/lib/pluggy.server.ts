const base = "https://api.pluggy.ai";
export async function pluggyKey(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("A conexão Pluggy ainda não foi configurada.");
  const res = await fetch(`${base}/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, clientSecret }), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Pluggy (${res.status}): ${await res.text()}`);
  const data = await res.json() as { apiKey?: string };
  if (!data.apiKey) throw new Error("Pluggy não autorizou a conexão.");
  return data.apiKey;
}
export async function pluggyRequest<T>(key: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { "X-API-KEY": key, "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`Pluggy (${res.status}): ${await res.text()}`);
  return res.status === 204 ? undefined as T : await res.json() as T;
}