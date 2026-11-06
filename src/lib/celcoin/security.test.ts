/// <reference types="node" />
// Garantias estáticas: segredos fora do frontend, sem acesso direto à rede, PIX sem implementação.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const srcDir = join(root, "src");
const celcoinDir = join(srcDir, "lib", "celcoin");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const read = (p: string) => readFileSync(p, "utf8");
const rel = (p: string) => p.slice(root.length).replace(/\\/g, "/");

const productionFiles = readdirSync(celcoinDir)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "test-support.ts")
  .map((f) => join(celcoinDir, f));

describe("segredos e fronteira servidor/cliente", () => {
  it("nenhuma variável CELCOIN usa o prefixo VITE_ (iria para o navegador)", () => {
    for (const f of walk(srcDir).filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith("security.test.ts"))) {
      assert.ok(!/VITE_CELCOIN/i.test(read(f)), `${rel(f)} referencia VITE_CELCOIN`);
    }
  });

  it("arquivos .env não contêm configuração da Celcoin", () => {
    for (const name of [".env", ".env.development", ".env.production", ".env.local"]) {
      const p = join(root, name);
      if (existsSync(p)) assert.ok(!/CELCOIN/i.test(read(p)), `${name} contém CELCOIN`);
    }
  });

  it("só módulos .server.ts leem process.env ou importam segredos", () => {
    for (const f of productionFiles) {
      const text = read(f);
      const name = rel(f);
      if (/process\.env/.test(text)) assert.ok(name.endsWith(".server.ts"), `${name} lê process.env`);
    }
  });

  it("nada fora de src/lib/celcoin e src/lib/recharge importa módulos celcoin", () => {
    for (const f of walk(srcDir).filter((p) => /\.(ts|tsx)$/.test(p))) {
      const name = rel(f);
      if (name.startsWith("src/lib/celcoin/") || name.startsWith("src/lib/recharge/")) continue;
      assert.ok(!/from\s+["'][^"']*celcoin[^"']*["']/.test(read(f)), `${name} importa celcoin`);
    }
  });

  it("módulos que lidam com credenciais são .server.ts", () => {
    for (const f of productionFiles) {
      const text = read(f);
      if (/clientSecret|CELCOIN_CLIENT_SECRET/.test(text)) {
        assert.ok(rel(f).endsWith(".server.ts"), `${rel(f)} manipula segredos`);
      }
    }
  });

  it("não há segredo literal nos arquivos de produção", () => {
    for (const f of productionFiles) {
      const text = read(f);
      assert.ok(!/client_secret\s*[:=]\s*["'][^"']{8,}["']/.test(text), `${rel(f)} parece conter segredo`);
      assert.ok(!/Bearer\s+[A-Za-z0-9._-]{20,}/.test(text), `${rel(f)} parece conter token`);
    }
  });
});

describe("nenhum acesso direto à rede", () => {
  it("módulos de produção não chamam fetch global nem outros clientes de rede", () => {
    for (const f of productionFiles) {
      const text = read(f).replace(/\/\/.*$/gm, "");
      assert.ok(!/(^|[^.\w])fetch\(/.test(text), `${rel(f)} chama fetch diretamente`);
      assert.ok(!/globalThis\.fetch|XMLHttpRequest|node:https?|WebSocket|axios/.test(text), `${rel(f)} usa rede`);
    }
  });

  it("o cliente HTTP só usa o fetch injetado", () => {
    const text = read(join(celcoinDir, "http-client.server.ts"));
    assert.ok(/this\.deps\.fetch\(/.test(text));
  });
});

describe("PIX permanece separado e sem implementação", () => {
  it("pix-provider.ts contém apenas tipos (nenhuma função, classe ou chamada)", () => {
    const text = read(join(celcoinDir, "pix-provider.ts")).replace(/\/\/.*$/gm, "");
    assert.ok(!/\bfunction\b|\bclass\b|=>\s*\{|\bawait\b/.test(text));
    assert.ok(!existsSync(join(celcoinDir, "pix-immediate.server.ts")));
  });

  it("nenhum arquivo implementa PixChargeProvider nem referencia endpoints de PIX/boleto", () => {
    for (const f of productionFiles.filter((p) => !p.endsWith("pix-provider.ts"))) {
      const text = read(f).replace(/\/\/.*$/gm, "");
      assert.ok(!/implements\s+PixChargeProvider/.test(text), rel(f));
      assert.ok(!/\/pix\/v1|\/baas\/v2\/charge|BOLEPIX/i.test(text), rel(f));
    }
  });
});
