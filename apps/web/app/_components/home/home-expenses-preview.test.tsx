// @vitest-environment jsdom

// Régression edge case accueil (todo.md) — `HomeExpensesPreview` doit basculer
// vers `FirstExpenseInvite` quand `MovementsList` signale `onEmptyChange(true)`
// (fetch ciblé confirmant un foyer vide), SANS jamais démonter `MovementsList`
// : le démonter couperait son abonnement au bus `notifyDataChanged(["expenses"])`,
// et un ajout ultérieur depuis /ajouter (route interceptée, même instance de
// page, jamais de navigation complète) laisserait l'accueil bloqué sur
// `FirstExpenseInvite` (revue Copilot, PR #17). `MovementsList` mocké : ce
// test couvre uniquement le câblage état local ↔ affichage, pas sa logique
// interne (couverte par movements-list.test.tsx).

import { act, createElement, useEffect, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@app/domain-expense";
import { HomeExpensesPreview } from "./home-expenses-preview";

let capturedOnEmptyChange: ((isEmpty: boolean) => void) | undefined;
let mountCount = 0;

vi.mock("../expenses/movements-list", () => ({
  MovementsList: (props: { onEmptyChange?: (isEmpty: boolean) => void }) => {
    capturedOnEmptyChange = props.onEmptyChange;
    useEffect(() => {
      mountCount += 1;
      // Pas de cleanup nécessaire au delà du compteur : le test observe
      // uniquement "combien de fois ce composant a-t-il été monté".
    }, []);
    return createElement("div", { "data-testid": "movements-list" }, "liste");
  },
}));

const reactGlobals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

const members = [{ memberId: "m1", displayName: "Nathan", defaultSharePct: 50 }];

function makeExpense(id: string): Expense {
  return {
    id,
    householdId: "h1",
    label: "Courses",
    category: "courses",
    grossCents: 1000,
    payerId: "m1",
    incurredOn: "2026-06-10",
    source: "manual",
    settlementId: null,
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
    shares: [],
    aids: [],
  };
}

describe("HomeExpensesPreview", () => {
  let container: HTMLDivElement;
  let root: Root;

  function render(element: ReactElement) {
    act(() => {
      root.render(element);
    });
  }

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    capturedOnEmptyChange = undefined;
    mountCount = 0;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("affiche FirstExpenseInvite quand onEmptyChange(true), SANS démonter MovementsList", () => {
    render(
      createElement(HomeExpensesPreview, {
        initialExpenses: [makeExpense("e1")],
        members,
        currentMemberId: "m1",
      }),
    );

    expect(container.querySelector('[data-testid="movements-list"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/aucune dépense/);
    expect(mountCount).toBe(1);

    act(() => {
      capturedOnEmptyChange?.(true);
    });

    // MovementsList reste dans l'arbre (même instance, toujours abonnée au
    // bus) — seul FirstExpenseInvite apparaît à côté.
    expect(container.querySelector('[data-testid="movements-list"]')).not.toBeNull();
    expect(mountCount).toBe(1);
    expect(container.textContent).toMatch(/aucune dépense/);
  });

  it("repeuplement (onEmptyChange(false)) fait disparaître FirstExpenseInvite sans remonter MovementsList", () => {
    render(
      createElement(HomeExpensesPreview, {
        initialExpenses: [],
        members,
        currentMemberId: "m1",
      }),
    );

    expect(container.textContent).toMatch(/aucune dépense/);
    expect(mountCount).toBe(1);

    act(() => {
      capturedOnEmptyChange?.(false);
    });

    expect(container.textContent).not.toMatch(/aucune dépense/);
    // Repeuplé par le MÊME MovementsList (jamais démonté puis remonté) —
    // c'est précisément ce qui garantit que son abonnement au bus a survécu.
    expect(mountCount).toBe(1);
  });

  it("affiche directement FirstExpenseInvite si le foyer est déjà vide au montage", () => {
    render(
      createElement(HomeExpensesPreview, {
        initialExpenses: [],
        members,
        currentMemberId: "m1",
      }),
    );

    expect(container.querySelector('[data-testid="movements-list"]')).not.toBeNull();
    expect(container.textContent).toMatch(/aucune dépense/);
  });
});
