// @vitest-environment jsdom

// Régression edge case accueil (todo.md) — `HomeExpensesPreview` doit basculer
// vers `FirstExpenseInvite` quand `MovementsList` signale `onEmptied` (fetch
// ciblé confirmant un foyer vide), sans attendre une navigation complète.
// `MovementsList` mocké : ce test couvre uniquement le câblage état local ↔
// bascule d'affichage, pas la logique interne de `MovementsList` (couverte par
// movements-list.test.tsx).

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@app/domain-expense";
import { HomeExpensesPreview } from "./home-expenses-preview";

let capturedOnEmptied: (() => void) | undefined;

vi.mock("../expenses/movements-list", () => ({
  MovementsList: (props: { onEmptied?: () => void }) => {
    capturedOnEmptied = props.onEmptied;
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
    capturedOnEmptied = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("affiche MovementsList tant que le foyer a des dépenses, bascule sur FirstExpenseInvite quand onEmptied est appelé", () => {
    render(
      createElement(HomeExpensesPreview, {
        initialExpenses: [makeExpense("e1")],
        members,
        currentMemberId: "m1",
      }),
    );

    expect(container.querySelector('[data-testid="movements-list"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/aucune dépense/);

    act(() => {
      capturedOnEmptied?.();
    });

    expect(container.querySelector('[data-testid="movements-list"]')).toBeNull();
    expect(container.textContent).toMatch(/aucune dépense/);
  });

  it("affiche directement FirstExpenseInvite si le foyer est déjà vide au montage", () => {
    render(
      createElement(HomeExpensesPreview, {
        initialExpenses: [],
        members,
        currentMemberId: "m1",
      }),
    );

    expect(container.querySelector('[data-testid="movements-list"]')).toBeNull();
    expect(container.textContent).toMatch(/aucune dépense/);
  });
});
