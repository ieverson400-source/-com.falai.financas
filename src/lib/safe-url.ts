/**
 * Validates a user-supplied URL meant to be fetched by the server.
 * - HTTPS only
 * - Rejects hostnames that are IP literals in private / loopback / link-local /
 *   metadata ranges, plus common internal hostnames.
 *
 * Note: this does NOT do a DNS lookup, so a hostname that resolves to a private
 * IP at runtime is not blocked here. The Worker egress already prevents most
 * such access, but if stricter SSRF protection is required, route the call
 * through an allowlisted proxy.
 */
export function assertSafeOutboundUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL inválida.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Apenas URLs HTTPS são permitidas.");
  }

  const host = url.hostname.toLowerCase();

  // Block obvious internal hostnames
  const blockedHosts = new Set([
    "localhost",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
  ]);
  if (blockedHosts.has(host) || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("Host não permitido.");
  }

  // Block IP literals in private/loopback/link-local/cloud-metadata ranges
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) || // link-local / AWS IMDS
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast / reserved
    ) {
      throw new Error("Endereço IP interno não permitido.");
    }
  }

  // Block IPv6 loopback / link-local / unique-local
  if (host.startsWith("[")) {
    const v6 = host.replace(/^\[|\]$/g, "");
    if (
      v6 === "::1" ||
      v6 === "::" ||
      v6.startsWith("fe80:") ||
      v6.startsWith("fc") ||
      v6.startsWith("fd")
    ) {
      throw new Error("Endereço IPv6 interno não permitido.");
    }
  }

  return url;
}
