import { describe, it, expect } from "vitest";
import { canTransitionSettlement, validateSettlementTransition } from "./transitions";
import type { SettlementStatus } from "./types";

const ALL_STATUSES: SettlementStatus[] = ["pending", "confirmed", "cancelled"];

describe("canTransitionSettlement — machine à états settlement (ch.5.3, D16 v0.3)", () => {
  it("pending → confirmed : légale", () => {
    expect(canTransitionSettlement("pending", "confirmed")).toBe(true);
  });

  it("pending → cancelled : légale", () => {
    expect(canTransitionSettlement("pending", "cancelled")).toBe(true);
  });

  it("pending → pending : illégale (pas de no-op)", () => {
    expect(canTransitionSettlement("pending", "pending")).toBe(false);
  });

  it("confirmed est un état terminal : aucune transition sortante", () => {
    for (const to of ALL_STATUSES) {
      expect(canTransitionSettlement("confirmed", to)).toBe(false);
    }
  });

  it("cancelled est un état terminal : aucune transition sortante", () => {
    for (const to of ALL_STATUSES) {
      expect(canTransitionSettlement("cancelled", to)).toBe(false);
    }
  });
});

describe("validateSettlementTransition", () => {
  it("transition légale → null", () => {
    expect(validateSettlementTransition("pending", "confirmed")).toBeNull();
    expect(validateSettlementTransition("pending", "cancelled")).toBeNull();
  });

  it("transition illégale → AppError CONFLICT", () => {
    const error = validateSettlementTransition("confirmed", "cancelled");
    expect(error).not.toBeNull();
    expect(error?.code).toBe("CONFLICT");
  });

  it("confirmed → pending : rejetée", () => {
    expect(validateSettlementTransition("confirmed", "pending")?.code).toBe("CONFLICT");
  });

  it("cancelled → confirmed : rejetée", () => {
    expect(validateSettlementTransition("cancelled", "confirmed")?.code).toBe("CONFLICT");
  });

  it("cancelled → pending : rejetée", () => {
    expect(validateSettlementTransition("cancelled", "pending")?.code).toBe("CONFLICT");
  });
});
