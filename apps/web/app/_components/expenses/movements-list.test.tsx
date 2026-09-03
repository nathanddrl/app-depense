// @vitest-environment jsdom

// Régression edge case accueil (todo.md, issu de T-CF1/T-CF3) — distincte du
// scénario déjà couvert par `tests/server-state-sync.test.ts` (accueil
// initialement vide, une dépense ajoutée sans navigation). Ici, le foyer a
// une (seule) dépense au montage ; on la supprime via le flux réel
// (clic ligne → `ExpenseEditForm` → « supprimer » → toast d'annulation) et on
// prouve `onEmptyChange` : appelé seulement après confirmation serveur (jamais
// pendant l'animation de sortie, jamais si l'utilisateur clique « annuler »
// avant l'échéance du toast), et dans les DEUX sens — y compris le
// repeuplement via le bus `notifyDataChanged`, chemin réel d'un ajout depuis
// /ajouter (route interceptée, jamais de démontage de MovementsList, cf.
// revue Copilot sur PR #17 / home-expenses-preview.tsx).
//
// Même pattern que `settlement-controls.test.tsx` : `react-dom/client` + `act`
// direct, Server Actions mockées (`../../actions` porte `"use server"`).

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@app/domain-expense";
import { MovementsList } from "./movements-list";
import { GlobalProgressProvider } from "../design-system/feedback";
import { notifyDataChanged } from "../data-refresh/data-refresh-bus";

const listExpensesAction = vi.fn();
const deleteExpenseAction = vi.fn();
const updateExpenseAction = vi.fn();

vi.mock("../../actions", () => ({
  listExpensesAction: (...args: unknown[]) => listExpensesAction(...args),
  deleteExpenseAction: (...args: unknown[]) => deleteExpenseAction(...args),
  updateExpenseAction: (...args: unknown[]) => updateExpenseAction(...args),
}));

const reactGlobals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

const members = [
  { memberId: "m1", displayName: "Nathan", defaultSharePct: 50 },
  { memberId: "m2", displayName: "Oksana", defaultSharePct: 50 },
];

function makeExpense(id: string): Expense {
  return {
    id,
    householdId: "h1",
    label: "Courses Lidl",
    category: "courses",
    grossCents: 7844,
    payerId: "m1",
    incurredOn: "2026-06-10",
    source: "manual",
    settlementId: null,
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
    shares: [
      { memberId: "m1", cents: 3922, pctSnapshot: 50 },
      { memberId: "m2", cents: 3922, pctSnapshot: 50 },
    ],
    aids: [],
  };
}

describe("MovementsList — suppression progressive jusqu'à 0 (aperçu accueil)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onEmptyChange: ReturnType<typeof vi.fn<(isEmpty: boolean) => void>>;

  function render(element: ReactElement) {
    act(() => {
      root.render(element);
    });
  }

  function renderList(expenses: Expense[]) {
    onEmptyChange = vi.fn<(isEmpty: boolean) => void>();
    render(
      createElement(
        GlobalProgressProvider,
        null,
        createElement(MovementsList, {
          expenses,
          members,
          currentMemberId: "m1",
          previewLimit: 3,
          onEmptyChange,
        }),
      ),
    );
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll("button"));
  }

  async function clickByText(text: string) {
    const btn = buttons().find((b) => b.textContent?.trim() === text);
    if (!btn) throw new Error(`bouton "${text}" introuvable`);
    await act(async () => {
      btn.click();
    });
  }

  // Ouvre `ExpenseEditForm` par un clic direct sur la ligne (pas un bouton —
  // la zone pressable, cf. commentaire d'en-tête de movements-list.tsx).
  async function openEditFormOn(label: string) {
    const row = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === label,
    );
    // La ligne n'affiche pas le libellé par défaut (`showLabel` off) — on
    // clique la cellule catégorie, toujours présente et pressable.
    const target = row ?? container.querySelector("[style*='cursor: pointer']");
    if (!target) throw new Error("ligne introuvable");
    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    listExpensesAction.mockReset();
    deleteExpenseAction.mockReset();
    updateExpenseAction.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("n'appelle PAS onEmptyChange pendant l'effacement ni si l'utilisateur annule", async () => {
    const expense = makeExpense("e1");
    renderList([expense]);

    await openEditFormOn("Courses Lidl");
    await clickByText("supprimer");

    // Phase 1 (effacement sur place, EXIT_MS) : pas encore de commit serveur.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(onEmptyChange).not.toHaveBeenCalled();
    expect(deleteExpenseAction).not.toHaveBeenCalled();

    // « annuler » avant l'échéance du toast (3s) : aucune suppression commitée.
    await clickByText("annuler");
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(deleteExpenseAction).not.toHaveBeenCalled();
    expect(onEmptyChange).not.toHaveBeenCalled();
  });

  it("appelle onEmptyChange(true) une fois la dernière dépense réellement supprimée côté serveur", async () => {
    const expense = makeExpense("e1");
    deleteExpenseAction.mockResolvedValue({ ok: true, data: undefined });
    listExpensesAction.mockResolvedValue({ ok: true, data: [] });
    renderList([expense]);

    await openEditFormOn("Courses Lidl");
    await clickByText("supprimer");

    // Échéance du toast (3s par défaut) : commit réel + fetch ciblé.
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteExpenseAction).toHaveBeenCalledWith({ expenseId: "e1" });
    expect(listExpensesAction).toHaveBeenCalled();
    expect(onEmptyChange).toHaveBeenCalledTimes(1);
    expect(onEmptyChange).toHaveBeenCalledWith(true);
  });

  it("appelle onEmptyChange(false) si d'autres dépenses restent au-delà de l'aperçu tronqué", async () => {
    const expense = makeExpense("e1");
    deleteExpenseAction.mockResolvedValue({ ok: true, data: undefined });
    // Le fetch ciblé n'est pas limité par previewLimit côté serveur : il peut
    // renvoyer des dépenses plus anciennes que celles affichées à l'écran.
    listExpensesAction.mockResolvedValue({ ok: true, data: [makeExpense("e0")] });
    renderList([expense]);

    await openEditFormOn("Courses Lidl");
    await clickByText("supprimer");
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onEmptyChange).toHaveBeenCalledWith(false);
  });

  it("appelle onEmptyChange(false) sur un repeuplement via le bus, SANS démontage (chemin réel /ajouter)", async () => {
    // Foyer vide au montage (comme après une suppression jusqu'à 0) : c'est
    // exactement l'état dans lequel `HomeExpensesPreview` garde `MovementsList`
    // monté (jamais démonté selon `empty`, cf. son commentaire) — un ajout
    // depuis la route interceptée /ajouter notifie le bus sans navigation
    // complète, `MovementsList` doit rester abonné pour le voir.
    listExpensesAction.mockResolvedValue({ ok: true, data: [makeExpense("e1")] });
    renderList([]);
    expect(onEmptyChange).not.toHaveBeenCalled();

    await act(async () => {
      notifyDataChanged(["expenses"]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listExpensesAction).toHaveBeenCalled();
    expect(onEmptyChange).toHaveBeenCalledWith(false);
  });
});
