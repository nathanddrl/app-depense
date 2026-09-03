// @vitest-environment jsdom

// Détection auto de catégorie côté formulaire (spec-technique §6) : couvre le
// câblage `libellé → select`, le verrou « l'utilisateur a choisi » et sa remise
// à zéro après un ajout réussi. Le matching lui-même est testé isolément dans
// `detect-category.test.ts`.
//
// Même pattern que `settlement-controls.test.tsx` : `react-dom/client` + `act`,
// sans testing-library (non installé dans ce repo).

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ExpenseForm, type NewExpenseInput } from "./expense-form";

const reactGlobals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe("ExpenseForm — catégorie devinée depuis le libellé", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSubmit: Mock<(input: NewExpenseInput) => Promise<boolean>>;

  function renderForm() {
    onSubmit = vi.fn<(input: NewExpenseInput) => Promise<boolean>>(async () => true);
    act(() => {
      root.render(
        createElement(ExpenseForm, {
          currentMemberId: "membre-1",
          defaultShares: [
            { memberId: "membre-1", displayName: "Alex", defaultSharePct: 50 },
            { memberId: "membre-2", displayName: "Sam", defaultSharePct: 50 },
          ],
          pending: false,
          error: null,
          onSubmit,
        }),
      );
    });
  }

  // Les champs sont contrôlés par React : passer par le setter natif du
  // prototype pour que l'event `input` porte bien la nouvelle valeur.
  function setInputValue(el: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function inputByLabel(text: string): HTMLInputElement {
    const wrapper = Array.from(container.querySelectorAll("label")).find((l) =>
      l.textContent?.toLowerCase().includes(text),
    );
    const input = wrapper?.querySelector("input");
    if (!input) throw new Error(`champ "${text}" introuvable`);
    return input as HTMLInputElement;
  }

  function categorySelect(): HTMLSelectElement {
    const select = container.querySelector("select");
    if (!select) throw new Error("select catégorie introuvable");
    return select as HTMLSelectElement;
  }

  function typeLabel(value: string) {
    act(() => {
      setInputValue(inputByLabel("libellé"), value);
    });
  }

  function pickCategory(value: string) {
    const select = categorySelect();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderForm();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("pré-remplit la catégorie pendant la saisie du libellé", () => {
    expect(categorySelect().value).toBe("autre");
    typeLabel("Loyer appartement");
    expect(categorySelect().value).toBe("loyer");
    typeLabel("Carrefour");
    expect(categorySelect().value).toBe("courses");
  });

  it("laisse la catégorie inchangée quand rien ne matche", () => {
    typeLabel("Netflix");
    expect(categorySelect().value).toBe("abonnements");
    typeLabel("cadeau anniversaire");
    expect(categorySelect().value).toBe("abonnements");
  });

  it("n'écrase plus la catégorie après un choix manuel", () => {
    pickCategory("shopping");
    typeLabel("Carrefour");
    expect(categorySelect().value).toBe("shopping");
  });

  it("n'écrase plus la catégorie même si la détection a déjà joué avant", () => {
    typeLabel("Carrefour");
    expect(categorySelect().value).toBe("courses");
    pickCategory("autre");
    typeLabel("Carrefour et Netflix");
    expect(categorySelect().value).toBe("autre");
  });

  it("réarme la détection pour la dépense suivante après un ajout réussi", async () => {
    pickCategory("shopping");
    typeLabel("Netflix");
    act(() => {
      setInputValue(inputByLabel("montant"), "12,99");
    });

    const submit = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "ajouter",
    );
    await act(async () => {
      submit?.click();
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: "shopping" }));

    // Formulaire vidé : le verrou est levé, la détection reprend la main.
    expect(categorySelect().value).toBe("autre");
    typeLabel("Netflix");
    expect(categorySelect().value).toBe("abonnements");
  });
});
