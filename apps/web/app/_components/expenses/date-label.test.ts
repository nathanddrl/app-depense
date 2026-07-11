import { describe, it, expect } from "vitest";
import { dayLabel, monthLabel } from "./date-label";

describe("dayLabel", () => {
  it("formate une date jour+mois sans année", () => {
    expect(dayLabel("2026-07-09")).toBe("9 juillet");
  });
});

describe("monthLabel", () => {
  it("formate une clé de mois en « mois année »", () => {
    expect(monthLabel("2026-07")).toBe("juillet 2026");
  });

  it("distingue deux années sur le même mois", () => {
    expect(monthLabel("2025-07")).toBe("juillet 2025");
    expect(monthLabel("2026-07")).toBe("juillet 2026");
  });
});
