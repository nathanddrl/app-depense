// @vitest-environment jsdom

// Tests de rendu React de l'écran « d'où vient l'écart » (refonte solde) :
// navigation par niveaux (donut → catégories → dépenses), fil d'ariane,
// état vide (période sans dépense), et visibilité du bouton « solder »
// (niveau 1 seulement). Même pattern que settlement-controls.test.tsx :
// react-dom/client + act, sans testing-library (non installé dans ce repo).

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GlobalProgressProvider } from "../design-system/feedback";
import { BalanceBreakdownScreen } from "./balance-breakdown";
import styles from "./balance-breakdown.module.css";
import type { BalanceBreakdown } from "../../actions";
import type { MemberShare } from "../../../lib/household";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const reactGlobals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

const members: MemberShare[] = [
  { memberId: "nathan", displayName: "nathan", defaultSharePct: 50 },
  { memberId: "sam", displayName: "sam", defaultSharePct: 50 },
];

const data: BalanceBreakdown = {
  balance: { from: "sam", to: "nathan", amountCents: 4000 },
  periodStart: null,
  members: [
    {
      memberId: "nathan",
      totalCents: 30000,
      categories: [
        {
          category: "loyer",
          totalCents: 30000,
          expenses: [{ id: "e1", label: "loyer de mars", cents: 30000 }],
        },
      ],
    },
    {
      memberId: "sam",
      totalCents: 10000,
      categories: [
        {
          category: "courses",
          totalCents: 6000,
          expenses: [{ id: "e2", label: "courses", cents: 6000 }],
        },
        {
          category: "sorties",
          totalCents: 4000,
          expenses: [{ id: "e3", label: "ciné", cents: 4000 }],
        },
      ],
    },
  ],
};

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("BalanceBreakdownScreen — écran « d'où vient l'écart »", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onClose: Mock<() => void>;

  function render(props: Partial<Parameters<typeof BalanceBreakdownScreen>[0]> = {}) {
    onClose = vi.fn<() => void>();
    act(() => {
      root.render(
        createElement(
          GlobalProgressProvider,
          null,
          createElement(BalanceBreakdownScreen, {
            data,
            currentMemberId: "sam",
            members,
            settlementControls: createElement("div", { "data-testid": "settle" }, "solder-marker"),
            onClose,
            ...props,
          }),
        ),
      );
    });
  }

  function clickSliceByLabel(labelPrefix: string) {
    const path = [...container.querySelectorAll('path[role="button"]')].find((p) =>
      p.getAttribute("aria-label")?.startsWith(labelPrefix),
    );
    if (!path) throw new Error(`part "${labelPrefix}" introuvable`);
    act(() => {
      path.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  function breadcrumbText(): string {
    const items = [...container.querySelectorAll(`.${styles.breadcrumbItem}`)];
    // Chaque item peut porter le séparateur « › » en tête (enfant caché aux
    // lecteurs d'écran) — retiré ici pour ne comparer que les libellés.
    return items.map((el) => el.textContent?.replace("›", "").trim()).join(" › ");
  }

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    mockMatchMedia(true);
    pushMock.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("niveau 1 : une part par membre, bouton solder visible, fil d'ariane réduit à « tout »", () => {
    render();
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="settle"]')).not.toBeNull();
    expect(breadcrumbText()).toBe("tout");
  });

  it("tap sur un membre → niveau 2 (ses catégories), solder disparaît, fil d'ariane grandit", () => {
    render();
    clickSliceByLabel("sam");

    const categoryPaths = [...container.querySelectorAll('path[role="button"]')];
    expect(categoryPaths).toHaveLength(2); // courses, sorties
    expect(container.querySelector('[data-testid="settle"]')).toBeNull();
    expect(breadcrumbText()).toBe("tout › sam");
  });

  it("tap sur une catégorie → niveau 3 (ses dépenses), parts non cliquables (feuille)", () => {
    render();
    clickSliceByLabel("sam");
    clickSliceByLabel("courses");

    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(0);
    const legend = container.querySelector("ul")?.textContent ?? "";
    expect(legend).toContain("courses");
    expect(breadcrumbText()).toBe("tout › sam › courses");
  });

  it("fil d'ariane : clic sur « tout » depuis le niveau 3 revient directement au niveau 1", () => {
    render();
    clickSliceByLabel("sam");
    clickSliceByLabel("courses");

    const toutButton = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "tout",
    );
    act(() => {
      toutButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(breadcrumbText()).toBe("tout");
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="settle"]')).not.toBeNull();
  });

  it("période sans dépense : état vide orienté action, jamais un donut vide", () => {
    const emptyData: BalanceBreakdown = {
      balance: { from: "sam", to: "nathan", amountCents: 0 },
      periodStart: null,
      members: [
        { memberId: "nathan", totalCents: 0, categories: [] },
        { memberId: "sam", totalCents: 0, categories: [] },
      ],
    };
    render({ data: emptyData });

    expect(container.querySelectorAll("path")).toHaveLength(0);
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "ajouter une dépense",
    );
    expect(button).not.toBeUndefined();

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/ajouter");
  });

  it("solde nul avec dépenses existantes : écran cohérent, pas de bouton solder", () => {
    const zeroBalanceData: BalanceBreakdown = {
      ...data,
      balance: { from: "sam", to: "nathan", amountCents: 0 },
    };
    render({ data: zeroBalanceData, settlementControls: null });
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="settle"]')).toBeNull();
  });
});
