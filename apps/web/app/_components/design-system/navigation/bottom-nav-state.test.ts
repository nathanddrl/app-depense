import { describe, it, expect } from "vitest";
import { NAV_ADD_VALUE, isNavItemActive } from "./bottom-nav-state";

describe("isNavItemActive", () => {
  it("un item est actif quand sa valeur est l'écran courant", () => {
    expect(isNavItemActive("accueil", "accueil")).toBe(true);
    expect(isNavItemActive("mouvements", "mouvements")).toBe(true);
    expect(isNavItemActive("reglages", "reglages")).toBe(true);
  });

  it("un item n'est pas actif quand un autre écran est courant", () => {
    expect(isNavItemActive("accueil", "mouvements")).toBe(false);
    expect(isNavItemActive("reglages", "accueil")).toBe(false);
  });

  it("« ajouter » n'est jamais actif, même quand l'écran ajouter est ouvert", () => {
    expect(isNavItemActive(NAV_ADD_VALUE, NAV_ADD_VALUE)).toBe(false);
    expect(isNavItemActive(NAV_ADD_VALUE, "accueil")).toBe(false);
  });
});
