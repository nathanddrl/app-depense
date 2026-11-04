// @vitest-environment jsdom

// Relevé de l'écart (niveau 1 de « d'où vient l'écart ») : lignes masquées
// quand elles n'apportent rien, sens du total pour chaque membre, détail
// dépliable des aides et des corrections. Même pattern que
// balance-breakdown.test.tsx (react-dom/client + act, sans testing-library).

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BalanceStatementView, SettlementCorrectionLine } from "@app/domain-expense";
import type { MemberShare } from "../../../lib/household";
import { BalanceStatementLines } from "./balance-statement";

const reactGlobals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

const members: MemberShare[] = [
  { memberId: "nathan", displayName: "nathan", defaultSharePct: 50 },
  { memberId: "oksana", displayName: "oksana", defaultSharePct: 50 },
];

const zeroLines: BalanceStatementView["lines"] = {
  paidCents: 0,
  grossShareCents: 0,
  expensesCents: 0,
  aidReceivedCents: 0,
  aidOtherCents: 0,
  aidsCents: 0,
  settlementsCents: 0,
  correctionsCents: 0,
  totalCents: 0,
};

// Cas réel du bug : beaucoup plus payé que l'autre, et pourtant « tu dois ».
const nathanView: BalanceStatementView = {
  memberId: "nathan",
  lines: {
    ...zeroLines,
    paidCents: 92200,
    grossShareCents: 62500,
    expensesCents: 29700,
    aidReceivedCents: 51474,
    aidsCents: -25737,
    settlementsCents: -10000,
    totalCents: -6037,
  },
  sharePct: 50,
  aids: [
    {
      id: "a1",
      label: "APL",
      expenseLabel: "loyer",
      incurredOn: "2026-10-01",
      beneficiaryId: "nathan",
      amountCents: 51474,
    },
  ],
  settlements: [
    {
      fromMemberId: "oksana",
      toMemberId: "nathan",
      amountCents: 10000,
      confirmedAt: "2026-10-02T10:00:00.000Z",
    },
  ],
};

const owed = { from: "nathan", to: "oksana", amountCents: 6037 };

describe("BalanceStatementLines — relevé de l'écart", () => {
  let container: HTMLDivElement;
  let root: Root;

  function render(
    statement: BalanceStatementView,
    {
      balance = owed,
      currentMemberId = "nathan",
      corrections = [] as SettlementCorrectionLine[],
      periodStart = null as string | null,
    } = {},
  ) {
    act(() =>
      root.render(
        createElement(BalanceStatementLines, {
          statement,
          balance,
          corrections,
          periodStart,
          members,
          currentMemberId,
        }),
      ),
    );
  }
  // Intl insère des espaces insécables (fines) dans les montants : normalisées.
  const text = () => (container.textContent ?? "").replace(/\s/g, " ");

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("toutes les lignes, montants signés, et le total qui tombe sur le solde", () => {
    render(nathanView);
    expect(text()).toContain("les dépenses");
    expect(text()).toContain("+297,00 €");
    expect(text()).toContain("tu as payé 922,00 €, ta part était 625,00 € (50 %)");
    expect(text()).toContain("les aides");
    expect(text()).toContain("−257,37 €");
    expect(text()).toContain("tu as touché 514,74 €");
    expect(text()).toContain("les versements");
    expect(text()).toContain("oksana t'a versé 100,00 €");
    expect(text()).toContain("= tu dois 60,37 € à oksana");
  });

  it("aucune aide ni versement : ces lignes disparaissent", () => {
    render(
      {
        ...nathanView,
        lines: { ...zeroLines, paidCents: 10000, grossShareCents: 5000, expensesCents: 5000 },
        aids: [],
        settlements: [],
      },
      { balance: { from: "oksana", to: "nathan", amountCents: 5000 } },
    );
    expect(text()).toContain("les dépenses");
    expect(text()).not.toContain("les aides");
    expect(text()).not.toContain("les versements");
    expect(text()).toContain("= oksana te doit 50,00 €");
  });

  it("point de vue de l'autre membre : le total se lit dans l'autre sens", () => {
    render(
      {
        ...nathanView,
        memberId: "oksana",
        lines: { ...zeroLines, paidCents: 32800, grossShareCents: 62500, expensesCents: -29700 },
        aids: [],
        settlements: [],
      },
      { currentMemberId: "oksana" },
    );
    expect(text()).toContain("−297,00 €");
    expect(text()).toContain("= nathan te doit 60,37 €");
  });

  it("aides et corrections : détail dépliable, ligne corrections datée du règlement", () => {
    render(
      { ...nathanView, lines: { ...nathanView.lines, correctionsCents: -5000 } },
      {
        periodStart: "2026-09-15",
        corrections: [
          {
            expenseId: "e9",
            label: "courses",
            incurredOn: "2026-09-10",
            kind: "deleted",
            amountCents: 10000,
            balanceDelta: { nathan: -5000, oksana: 5000 },
          },
        ],
      },
    );
    const summaries = [...container.querySelectorAll("summary")].map((s) => s.textContent);
    expect(summaries).toEqual(["voir l'aide", "voir le changement"]);
    expect(text()).toContain("changé après le règlement du");
    expect(text()).toContain("retirée après coup");
    expect(text()).toContain("APL, sur loyer");
  });

  it("vocabulaire : jamais « remboursement » ni « dette »", () => {
    render(nathanView);
    expect(text()).not.toMatch(/rembours|dette|transaction/i);
  });
});
