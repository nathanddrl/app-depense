import { describe, it, expect } from "vitest";
import { currentMonthKey, dayLabel, monthLabel, recentMonthKeys } from "./date-label";

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

describe("currentMonthKey", () => {
  it("renvoie le mois courant au format YYYY-MM", () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("recentMonthKeys", () => {
  it("renvoie une fenêtre décroissante et contiguë, la plus récente en tête", () => {
    expect(recentMonthKeys(4, "2026-07")).toEqual(["2026-07", "2026-06", "2026-05", "2026-04"]);
  });

  it("franchit une année sans rupture de continuité", () => {
    expect(recentMonthKeys(3, "2026-01")).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});
