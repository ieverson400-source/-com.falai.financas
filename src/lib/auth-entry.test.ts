import { describe, it, expect } from "bun:test";
import { authEntryMode } from "./auth-entry";

describe("account entry", () => {
  it("opens registration for a new visitor", () => {
    expect(authEntryMode(null)).toBe("signup");
  });
  it("opens sign-in for a returning account on this device", () => {
    expect(authEntryMode("true")).toBe("signin");
  });
});