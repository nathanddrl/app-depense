import { describe, it, expect } from "vitest";
import { isAdmin, requireAdmin } from "./context";

describe("isAdmin", () => {
  it("true si role admin", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
  });

  it("false si role member", () => {
    expect(isAdmin({ role: "member" })).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("null si role admin", () => {
    expect(requireAdmin({ role: "admin" })).toBeNull();
  });

  it("FORBIDDEN si role member", () => {
    const result = requireAdmin({ role: "member" });
    expect(result).not.toBeNull();
    expect(result?.ok).toBe(false);
    if (!result || result.ok) throw new Error("attendu : échec FORBIDDEN");
    expect(result.error.code).toBe("FORBIDDEN");
  });
});
