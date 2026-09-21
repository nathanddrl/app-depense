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
import { BalanceBreakdownScreen, BalanceBreakdownTrigger } from "./balance-breakdown";
import styles from "./balance-breakdown.module.css";
import type { BalanceBreakdown } from "../../actions";
import type { MemberShare } from "../../../lib/household";

const getBalanceBreakdownAction = vi.fn();
vi.mock("../../actions", () => ({
  getBalanceBreakdownAction: (...args: unknown[]) => getBalanceBreakdownAction(...args),
}));

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
          expenses: [{ id: "e1", label: "loyer de mars", cents: 30000, incurredOn: "2026-03-01" }],
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
          expenses: [{ id: "e2", label: "courses", cents: 6000, incurredOn: "2026-03-02" }],
        },
        {
          category: "sorties",
          totalCents: 4000,
          expenses: [{ id: "e3", label: "ciné", cents: 4000, incurredOn: "2026-03-03" }],
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

  const text = () => (container.textContent ?? "").replace(/\s/g, " ");

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
    vi.useRealTimers();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("niveau 1 : une part par membre, bouton solder visible, fil d'ariane réduit à « tout »", () => {
    render();
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="settle"]')).not.toBeNull();
    expect(breadcrumbText()).toBe("tout");
  });

  it("niveau 1, écart sous 15 % du total : « presque étale » au centre, constat en « part »", () => {
    // 4 000 / 40 000 = 10 %. Lecteur = sam (débiteur) : c'est nathan qui a payé en trop.
    render();
    expect(text()).toContain("presque étale");
    expect(text()).not.toContain("tu dois");
    expect(text()).toContain("nathan a payé 40,00 € de plus que sa part");
    expect(text()).not.toContain("de plus que sam");
  });

  it("niveau 1, écart ≥ 15 % du total : le vrai montant au centre", () => {
    render({
      data: { ...data, balance: { from: "sam", to: "nathan", amountCents: 6000 } },
    });
    expect(text()).toContain("tu dois 60,00 € à nathan");
    expect(text()).not.toContain("presque étale");
  });

  it("niveau 1, lecteur créditeur : « tu as payé N de plus que ta part »", () => {
    render({
      currentMemberId: "nathan",
      data: { ...data, balance: { from: "sam", to: "nathan", amountCents: 6000 } },
    });
    expect(text()).toContain("sam te doit 60,00 €");
    expect(text()).toContain("tu as payé 60,00 € de plus que ta part");
  });

  it("niveau 1, solde nul : formule canonique, aucun constat", () => {
    render({ data: { ...data, balance: { from: "sam", to: "nathan", amountCents: 0 } } });
    expect(text()).toContain("vous êtes étale");
    expect(text()).not.toContain("presque étale");
    expect(text()).not.toContain("de plus que");
  });

  it("niveau 3 : des dépenses de même libellé se distinguent par leur date (la légende est le canal accessible des parts feuilles)", () => {
    const sameLabel: BalanceBreakdown = {
      ...data,
      members: [
        data.members[0],
        {
          memberId: "sam",
          totalCents: 20000,
          categories: [
            {
              category: "loyer",
              totalCents: 20000,
              expenses: [
                { id: "l1", label: "loyer", cents: 10000, incurredOn: "2026-03-05" },
                { id: "l2", label: "loyer", cents: 10000, incurredOn: "2026-02-05" },
              ],
            },
          ],
        },
      ],
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    render({ data: sameLabel });
    clickSliceByLabel("sam");
    clickSliceByLabel("loyer");
    const legend = container.querySelector("ul")?.textContent ?? "";
    expect(legend).toContain("loyer, 5 mars");
    expect(legend).toContain("loyer, 5 févr.");
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

  it("changement de niveau : le focus revient au conteneur de l'écran (jamais perdu sur <body>)", () => {
    render();
    const slice = [...container.querySelectorAll('path[role="button"]')].find((p) =>
      p.getAttribute("aria-label")?.startsWith("sam"),
    ) as SVGPathElement;
    slice.focus();
    clickSliceByLabel("sam");
    const content = container.querySelector('[tabindex="-1"]');
    expect(content).not.toBeNull();
    expect(document.activeElement).toBe(content);
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

describe("BalanceBreakdownTrigger — chargement, erreur, rechargement", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderTrigger(revision = "r1") {
    act(() => {
      root.render(
        createElement(
          GlobalProgressProvider,
          null,
          createElement(BalanceBreakdownTrigger, {
            currentMemberId: "sam",
            members,
            settlementControls: createElement("div", { "data-testid": "settle" }, "solder-marker"),
            revision,
          }),
        ),
      );
    });
  }

  async function flush() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  function buttonByText(text: string): HTMLButtonElement {
    const btn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === text,
    );
    if (!btn) throw new Error(`bouton "${text}" introuvable`);
    return btn;
  }

  async function click(text: string) {
    await act(async () => {
      buttonByText(text).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
  }

  const dialogText = () => container.querySelector('[role="dialog"]')?.textContent ?? "";
  const hasTrigger = () =>
    [...container.querySelectorAll("button")].some(
      (b) => b.textContent?.trim() === "d'où vient l'écart",
    );

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    mockMatchMedia(true);
    getBalanceBreakdownAction.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("le déclencheur est un texte explicite, écran fermé par défaut", () => {
    renderTrigger();
    expect(hasTrigger()).toBe(true);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(getBalanceBreakdownAction).not.toHaveBeenCalled();
  });

  it("ouverture : « calcul en cours… » tant que la Server Action n'a pas répondu, puis l'écran", async () => {
    let resolve!: (value: unknown) => void;
    getBalanceBreakdownAction.mockReturnValue(new Promise((r) => (resolve = r)));
    renderTrigger();
    await click("d'où vient l'écart");
    expect(dialogText()).toContain("calcul en cours");

    await act(async () => resolve({ ok: true, data }));
    expect(dialogText()).not.toContain("calcul en cours");
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
  });

  it("erreur métier (ok: false) : état d'erreur avec réessai, jamais bloqué sur le chargement", async () => {
    getBalanceBreakdownAction.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Foyer non autorisé." },
    });
    renderTrigger();
    await click("d'où vient l'écart");

    expect(dialogText()).toContain("le calcul ne répond pas pour le moment");
    expect(dialogText()).not.toContain("calcul en cours");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(() => buttonByText("réessayer")).not.toThrow();
  });

  it("Server Action qui LÈVE (base injoignable) : même état d'erreur, pas de chargement infini", async () => {
    getBalanceBreakdownAction.mockRejectedValue(new Error("fetch failed"));
    renderTrigger();
    await click("d'où vient l'écart");

    expect(dialogText()).toContain("le calcul ne répond pas pour le moment");
    expect(dialogText()).not.toContain("calcul en cours");
  });

  it("« réessayer » relance la Server Action et affiche l'écran au succès", async () => {
    getBalanceBreakdownAction.mockRejectedValueOnce(new Error("fetch failed"));
    getBalanceBreakdownAction.mockResolvedValueOnce({ ok: true, data });
    renderTrigger();
    await click("d'où vient l'écart");
    expect(dialogText()).toContain("ne répond pas");

    await click("réessayer");
    expect(getBalanceBreakdownAction).toHaveBeenCalledTimes(2);
    expect(dialogText()).not.toContain("ne répond pas");
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
  });

  it("copy d'erreur : déclarative, sans impératif ni point d'exclamation ni mot banni", async () => {
    getBalanceBreakdownAction.mockRejectedValue(new Error("boom"));
    renderTrigger();
    await click("d'où vient l'écart");
    const text = dialogText();
    expect(text).not.toMatch(/réessaie\b|essaie\b|patiente|veuillez/i);
    expect(text).not.toContain("!");
    expect(text).not.toMatch(/rembours/i);
  });

  it("le solde change pendant que l'écran est ouvert : rechargement, plus jamais un état périmé", async () => {
    getBalanceBreakdownAction.mockResolvedValueOnce({
      ok: true,
      data: { ...data, balance: { from: "sam", to: "nathan", amountCents: 6000 } },
    });
    renderTrigger("r1");
    await click("d'où vient l'écart");
    expect(getBalanceBreakdownAction).toHaveBeenCalledTimes(1);
    expect(dialogText()).toContain("tu dois");

    getBalanceBreakdownAction.mockResolvedValueOnce({
      ok: true,
      data: { ...data, balance: { from: "sam", to: "nathan", amountCents: 0 } },
    });
    renderTrigger("r2"); // BalanceCard a rafraîchi son solde (ex. règlement confirmé)
    await flush();

    expect(getBalanceBreakdownAction).toHaveBeenCalledTimes(2);
    expect(dialogText()).toContain("vous êtes étale");
    expect(dialogText()).not.toContain("tu dois");
  });

  it("échec d'un rechargement alors que des chiffres sont déjà affichés : on les garde, en le disant", async () => {
    getBalanceBreakdownAction.mockResolvedValueOnce({ ok: true, data });
    renderTrigger("r1");
    await click("d'où vient l'écart");

    getBalanceBreakdownAction.mockRejectedValueOnce(new Error("réseau"));
    renderTrigger("r2");
    await flush();

    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
    expect(dialogText()).toContain("n'ont pas pu être actualisés");
  });

  it("fermeture puis réouverture : nouvelle requête, retour au niveau 1", async () => {
    getBalanceBreakdownAction.mockResolvedValue({ ok: true, data });
    renderTrigger();
    await click("d'où vient l'écart");

    const memberPath = [...container.querySelectorAll('path[role="button"]')].find((p) =>
      p.getAttribute("aria-label")?.startsWith("sam"),
    );
    await act(async () => {
      memberPath?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(dialogText()).toContain("courses"); // niveau 2

    await click("annuler");
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await click("d'où vient l'écart");
    expect(getBalanceBreakdownAction).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
    expect(dialogText()).toContain("nathan"); // niveau 1 : les deux membres
  });
});

describe("BalanceBreakdownTrigger — focus et délai maximal", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderTrigger() {
    act(() => {
      root.render(
        createElement(
          GlobalProgressProvider,
          null,
          createElement(BalanceBreakdownTrigger, {
            currentMemberId: "sam",
            members,
            settlementControls: null,
            revision: "r1",
          }),
        ),
      );
    });
  }

  const dialogText = () => container.querySelector('[role="dialog"]')?.textContent ?? "";
  const button = (text: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    mockMatchMedia(true);
    getBalanceBreakdownAction.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("à la fermeture (Échap ou « annuler »), le focus revient au déclencheur", async () => {
    getBalanceBreakdownAction.mockResolvedValue({ ok: true, data });
    renderTrigger();
    const trigger = button("d'où vient l'écart");
    trigger.focus();
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    (document.activeElement as HTMLElement)?.blur();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("backend qui ne répond pas : après 20 s, état d'erreur (pas de chargement indéfini), et une réponse tardive rétablit l'écran", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let resolve!: (value: unknown) => void;
    getBalanceBreakdownAction.mockReturnValue(new Promise((r) => (resolve = r)));
    renderTrigger();
    await act(async () => {
      button("d'où vient l'écart").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(dialogText()).toContain("calcul en cours");

    await act(async () => {
      vi.advanceTimersByTime(19_000);
    });
    expect(dialogText()).toContain("calcul en cours");

    await act(async () => {
      vi.advanceTimersByTime(1_500);
    });
    expect(dialogText()).toContain("le calcul ne répond pas pour le moment");
    expect(dialogText()).not.toContain("calcul en cours");

    await act(async () => resolve({ ok: true, data }));
    expect(dialogText()).not.toContain("ne répond pas");
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(2);
  });
});
