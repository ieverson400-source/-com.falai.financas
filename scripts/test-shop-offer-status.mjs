import { strict as assert } from "node:assert";
import { offerStatus } from "../src/lib/shop-offer-status.ts";
const now = Date.parse("2026-10-27T12:00:00Z");
assert.equal(offerStatus({ is_active: false, starts_at: null, ends_at: null }, now), "Pendente / pausada");
assert.equal(offerStatus({ is_active: true, starts_at: null, ends_at: null }, now), "Aprovada");
assert.equal(offerStatus({ is_active: true, starts_at: null, ends_at: "2026-10-26T23:59:59Z" }, now), "Expirada");
assert.equal(offerStatus({ is_active: true, starts_at: "2026-10-28T00:00:00Z", ends_at: null }, now), "Agendada");
console.log("Shop approval and validity rules passed");