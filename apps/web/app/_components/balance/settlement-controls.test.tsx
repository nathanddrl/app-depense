// @vitest-environment jsdom

// Régression T-CM1 — modale de confirmation unique côté débiteur (bouton
// « Solder » seul, plus de second bouton permanent). Couvre : bascule du
// contenu de la MÊME modale (question par défaut ↔ montant personnalisé),
// fermeture par la croix sans appel serveur, et l'absence des mots bannis
// (« remboursé »/« remboursement ») ainsi que du vouvoiement dans les libellés
// affichés par le composant.
//
// Même pattern que `tests/server-state-sync.test.ts` : `react-dom/client` +
// `act` directement, sans testing-library (non installé dans ce repo). Les
// Server Actions sont mockées — `../../actions` porte `"use server"` et
// importe la couche Supabase/domain, non disponible hors runtime Next.

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettlementControls } from "./settlement-controls";
import { GlobalProgressProvider } from "../design-system/feedback";

const initiateSettlementAction = vi.fn();
const confirmSettlementAction = vi.fn();
const cancelSettlementAction = vi.fn();

vi.mock("../../actions", () => ({
  initiateSettlementAction: (...args: unknown[]) => initiateSettlementAction(...args),
  confirmSettlementAction: (...args: unknown[]) => confirmSettlementAction(...args),
  cancelSettlementAction: (...args: unknown[]) => cancelSettlementAction(...args),
}));

const reactGlobals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe("SettlementControls — modale de solde (T-CM1)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSettled: () => void;

  function render(element: ReactElement) {
    act(() => {
      root.render(element);
    });
  }

  function renderDebtorView() {
    onSettled = vi.fn<() => void>();
    render(
      createElement(
        GlobalProgressProvider,
        null,
        createElement(SettlementControls, {
          currentMemberId: "membre-1",
          debtorId: "membre-1",
          debtorName: "Alex",
          creditorName: "Sam",
          settlement: null,
          amountCents: 4_250,
          onSettled,
        }),
      ),
    );
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll("button"));
  }

  // `async` + `act(async …)` systématiques : le clic « confirmer » déclenche
  // un appel à une Server Action mockée (résolue en microtâche via
  // `startTransition`) — sans ça, React avertit d'une mise à jour hors `act`.
  async function clickByText(text: string) {
    const btn = buttons().find((b) => b.textContent?.trim() === text);
    if (!btn) throw new Error(`bouton "${text}" introuvable`);
    await act(async () => {
      btn.click();
    });
  }

  function dialog(): HTMLElement | null {
    return container.querySelector('[role="dialog"]');
  }

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    initiateSettlementAction.mockReset();
    confirmSettlementAction.mockReset();
    cancelSettlementAction.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("n'affiche qu'un seul bouton de déclenchement (« solder »), la modale fermée par défaut", () => {
    renderDebtorView();
    expect(dialog()).toBeNull();
    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toEqual(["solder"]);
  });

  it("ouvre la modale sur la question par défaut, montant total pré-rempli", async () => {
    renderDebtorView();
    await clickByText("solder");

    expect(dialog()).not.toBeNull();
    expect(dialog()?.textContent).toContain("42,50");
    expect(dialog()?.textContent).toContain("Sam");
    expect(buttons().some((b) => b.textContent?.trim() === "confirmer")).toBe(true);
    expect(buttons().some((b) => b.textContent?.trim() === "autre montant")).toBe(true);
  });

  it("« confirmer » sur la question par défaut déclenche le même appel que l'ancien bouton « solder » (montant total)", async () => {
    initiateSettlementAction.mockResolvedValue({
      ok: true,
      data: { id: "s1", status: "pending" },
    });
    renderDebtorView();
    await clickByText("solder");
    await clickByText("confirmer");

    expect(initiateSettlementAction).toHaveBeenCalledTimes(1);
    expect(initiateSettlementAction).toHaveBeenCalledWith({ amountCents: 4_250 });
  });

  it("« autre montant » bascule le contenu de la MÊME modale vers le champ personnalisé (pas une deuxième Dialog)", async () => {
    renderDebtorView();
    await clickByText("solder");
    const dialogsBefore = container.querySelectorAll('[role="dialog"]').length;

    await clickByText("autre montant");

    expect(container.querySelectorAll('[role="dialog"]').length).toBe(dialogsBefore);
    expect(container.querySelector("input")).not.toBeNull();
    expect(buttons().some((b) => b.textContent?.trim() === "envoyer")).toBe(true);
  });

  it("montant personnalisé > solde courant : le cran de confirmation s'affiche avec un bouton « confirmer » simple", async () => {
    renderDebtorView();
    await clickByText("solder");
    await clickByText("autre montant");

    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      input.dispatchEvent(new Event("focusin"));
    });
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      nativeSetter?.call(input, "100,00");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await clickByText("envoyer");

    // Premier clic au-dessus du solde : avertissement neutre, pas d'appel serveur.
    expect(initiateSettlementAction).not.toHaveBeenCalled();
    expect(buttons().some((b) => b.textContent?.trim() === "confirmer")).toBe(true);
    expect(dialog()?.textContent).not.toMatch(/remboursement|remboursé/i);

    initiateSettlementAction.mockResolvedValue({ ok: true, data: { id: "s1", status: "pending" } });
    await clickByText("confirmer");
    expect(initiateSettlementAction).toHaveBeenCalledWith({ amountCents: 10_000 });
  });

  it("la croix ferme la modale sans appel serveur, à l'étape par défaut comme à l'étape personnalisée", async () => {
    renderDebtorView();
    await clickByText("solder");
    let closeBtn = container.querySelector('button[aria-label="fermer"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    act(() => {
      closeBtn.click();
    });
    expect(dialog()).toBeNull();
    expect(initiateSettlementAction).not.toHaveBeenCalled();

    await clickByText("solder");
    await clickByText("autre montant");
    closeBtn = container.querySelector('button[aria-label="fermer"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    act(() => {
      closeBtn.click();
    });
    expect(dialog()).toBeNull();
    expect(initiateSettlementAction).not.toHaveBeenCalled();
  });

  it("aucun mot banni (« remboursé »/« remboursement ») ni vouvoiement dans le HTML rendu", async () => {
    renderDebtorView();
    await clickByText("solder");
    await clickByText("autre montant");

    const html = container.innerHTML;
    expect(html).not.toMatch(/rembours/i);
    expect(html).not.toMatch(/\bvous\b/i);
    expect(html).not.toMatch(/\bvotre\b/i);
    expect(html).not.toMatch(/\bvos\b/i);
  });
});
