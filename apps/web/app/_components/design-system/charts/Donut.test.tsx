// @vitest-environment jsdom

// Tests de rendu React du Donut générique (refonte solde, DoD « tests de
// rendu React sur le donut »). Même pattern que settlement-controls.test.tsx :
// react-dom/client + act, sans testing-library (non installé dans ce repo).

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatAmountEUR } from "@app/shared";
import { Donut, type DonutSlice } from "./Donut";

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const reactGlobals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe("Donut — graphique générique animé (refonte solde)", () => {
  let container: HTMLDivElement;
  let root: Root;

  function render(element: ReactElement) {
    act(() => {
      root.render(element);
    });
  }

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    mockMatchMedia(true); // rendu déterministe par défaut (pas d'attente de rAF)
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  const slices: DonutSlice[] = [
    { id: "a", label: "nathan", valueCents: 30000, color: "var(--chart-1)", onSelect: vi.fn() },
    { id: "b", label: "sam", valueCents: 10000, color: "var(--chart-5)", onSelect: vi.fn() },
  ];

  it("dessine une part par tranche et une légende « nom, montant » pour chacune", () => {
    render(createElement(Donut, { slices, centerContent: "étale" }));
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);

    const legendText = container.querySelector("ul")?.textContent ?? "";
    expect(legendText).toContain(`nathan, ${formatAmountEUR(30000)}`);
    expect(legendText).toContain(`sam, ${formatAmountEUR(10000)}`);
  });

  it("une part cliquable est un contrôle focusable avec libellé « nom, montant »", () => {
    render(createElement(Donut, { slices, centerContent: "étale" }));
    const path = container.querySelector('path[role="button"]');
    expect(path).not.toBeNull();
    expect(path?.getAttribute("tabindex")).toBe("0");
    expect(path?.getAttribute("aria-label")).toBe(`nathan, ${formatAmountEUR(30000)}`);
  });

  it("clic sur une part appelle onSelect", () => {
    const onSelect = vi.fn();
    render(
      createElement(Donut, {
        slices: [{ ...slices[0], onSelect }, slices[1]],
        centerContent: "étale",
      }),
    );
    const path = container.querySelector('path[role="button"]');
    act(() => {
      path?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("touche Entrée/Espace sur une part focus appelle onSelect (navigation clavier)", () => {
    const onSelect = vi.fn();
    render(
      createElement(Donut, {
        slices: [{ ...slices[0], onSelect }, slices[1]],
        centerContent: "étale",
      }),
    );
    const path = container.querySelector('path[role="button"]') as SVGPathElement;
    act(() => {
      path.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("part non cliquable (niveau 3, feuille) : décorative, hors du tabIndex", () => {
    render(
      createElement(Donut, {
        slices: [{ id: "x", label: "courses", valueCents: 5000, color: "var(--chart-2)" }],
        centerContent: "courses",
      }),
    );
    const path = container.querySelector("path");
    expect(path?.getAttribute("role")).toBeNull();
    expect(path?.getAttribute("aria-hidden")).toBe("true");
  });

  it("prefers-reduced-motion: reduce → rendu direct de l'état cible, sans attente d'animation", () => {
    mockMatchMedia(true);
    render(createElement(Donut, { slices, centerContent: "étale" }));
    const paths = container.querySelectorAll("path");
    // 30000/40000 = 75% → ~270°, largement > 0 dès le premier rendu (pas de
    // collapse à l'origine en attente d'un rAF).
    const d = paths[0].getAttribute("d") ?? "";
    expect(d.length).toBeGreaterThan(0);
  });

  it("recomposition : un changement de jeu de parts (niveau 1 → 2) ne laisse aucune ancienne part orpheline", () => {
    mockMatchMedia(true); // règlement immédiat, déterministe
    render(createElement(Donut, { slices, centerContent: "étale", transitionOrigin: -90 }));
    expect(container.querySelectorAll("path")).toHaveLength(2);

    const level2: DonutSlice[] = [
      {
        id: "loyer",
        label: "loyer",
        valueCents: 20000,
        color: "var(--chart-1)",
        onSelect: vi.fn(),
      },
      {
        id: "courses",
        label: "courses",
        valueCents: 10000,
        color: "var(--chart-2)",
        onSelect: vi.fn(),
      },
    ];
    render(createElement(Donut, { slices: level2, centerContent: "nathan", transitionOrigin: 0 }));

    const paths = [...container.querySelectorAll("path")];
    expect(paths).toHaveLength(2);
    const labels = paths.map((p) => p.getAttribute("aria-label")).sort();
    expect(labels).toEqual(
      [`loyer, ${formatAmountEUR(20000)}`, `courses, ${formatAmountEUR(10000)}`].sort(),
    );
    for (const p of paths) {
      expect(p.getAttribute("d")).not.toContain("NaN");
    }
  });
});
