// @vitest-environment jsdom

// Régression T-CF3 — resynchronisation props serveur → state local.
//
// Ce que le test prouve, dans l'ordre exact du bug observé en prod sur
// /mouvements : un composant client monté avec des données serveur, qui écrit
// ensuite dans son propre state (fetch ciblé T-CF1), doit adopter les nouvelles
// données quand le Server Component parent se re-rend SANS le démonter
// (`router.replace` sur les searchParams) — sinon la liste reste figée sur le
// mois précédemment chargé alors que l'URL a changé.
//
// Il prouve aussi la contrainte inverse, qui est la raison d'être de T-CF1 : un
// re-rendu client qui repasse LA MÊME valeur serveur ne doit pas écraser ce que
// le fetch ciblé vient d'écrire (sinon toute mutation serait annulée au premier
// re-rendu du parent).
//
// Pas de JSX ni de testing-library ici : `createElement` + `react-dom/client`
// suffisent, et le test reste un `.ts` — aucune configuration de transformation
// à ajouter pour un seul fichier. Le « fetch ciblé » est déclenché par un clic
// sur un bouton de la sonde (jamais par une capture du setter pendant le rendu,
// interdite par `react-hooks/globals` et de toute façon un effet de bord).

import { act, createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useServerState } from "../app/_components/data-refresh/use-server-state";

// Drapeau attendu par `act` hors testing-library (React 19) — pas déclaré dans
// les types React, d'où le cast local plutôt qu'un `declare global`.
const reactGlobals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

type Row = { id: string };

// Résultat que la sonde appliquera au prochain clic — l'équivalent de ce que
// `listExpensesAction` renverrait à `refreshExpenses()`.
let nextLocalFetch: Row[] = [];

function Probe({ serverRows }: { serverRows: Row[] }): ReactElement {
  const [rows, setRows] = useServerState(serverRows);
  return createElement(
    "div",
    null,
    createElement("span", null, rows.map((r) => r.id).join(",")),
    createElement("button", { type: "button", onClick: () => setRows(nextLocalFetch) }, "refetch"),
  );
}

// Voisin sans prop serveur : garde contre un effet de bord global du hook (son
// state local ne doit jamais être réinitialisé par une resynchronisation).
function Sibling(): ReactElement {
  const [n] = useState(1);
  return createElement("i", null, String(n));
}

let nextNullableFetch: Row[] | null = null;

function NullableProbe({ serverValue }: { serverValue: Row[] | null }): ReactElement {
  const [value, setValue] = useServerState(serverValue);
  return createElement(
    "div",
    null,
    createElement("span", null, value === null ? "vide" : value.map((r) => r.id).join(",")),
    createElement(
      "button",
      { type: "button", onClick: () => setValue(nextNullableFetch) },
      "refetch",
    ),
  );
}

describe("useServerState", () => {
  let container: HTMLDivElement;
  let root: Root;

  function render(element: ReactElement) {
    act(() => {
      root.render(element);
    });
  }

  function renderProbe(serverRows: Row[]) {
    render(
      createElement("div", null, createElement(Probe, { serverRows }), createElement(Sibling)),
    );
  }

  // Simule un fetch ciblé (T-CF1) : le composant écrit lui-même dans son state.
  function localFetch(rows: Row[]) {
    nextLocalFetch = rows;
    act(() => {
      container.querySelector("button")?.click();
    });
  }

  function displayed(): string {
    return container.querySelector("span")?.textContent ?? "";
  }

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    nextLocalFetch = [];
    nextNullableFetch = null;
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("adopte les nouvelles données serveur sans démontage (changement de filtre)", () => {
    renderProbe([{ id: "juin-1" }, { id: "juin-2" }]);
    expect(displayed()).toBe("juin-1,juin-2");

    // Ce que fait `router.replace(?mois=…)` : même composant client monté,
    // nouvelle charge utile RSC (donc nouvelle identité de tableau).
    renderProbe([{ id: "juillet-1" }]);
    expect(displayed()).toBe("juillet-1");

    // Le voisin n'a pas été remonté au passage.
    expect(container.querySelector("i")?.textContent).toBe("1");
  });

  it("conserve le résultat d'un fetch ciblé quand la valeur serveur ne change pas", () => {
    const initial = [{ id: "a" }, { id: "b" }];
    renderProbe(initial);

    // Suppression puis refetch local (T-CF1) : le state local fait autorité.
    localFetch([{ id: "a" }]);
    expect(displayed()).toBe("a");

    // Re-rendu du parent avec LA MÊME valeur serveur (aucune navigation) : la
    // dépense supprimée ne doit pas réapparaître.
    renderProbe(initial);
    expect(displayed()).toBe("a");
  });

  it("le serveur reprend la main après un fetch ciblé, à la navigation suivante", () => {
    renderProbe([{ id: "a" }]);
    localFetch([{ id: "local" }]);
    expect(displayed()).toBe("local");

    renderProbe([{ id: "serveur" }]);
    expect(displayed()).toBe("serveur");
  });

  it("accepte une valeur serveur nullable sans la confondre avec un state vide", () => {
    // Cas `initialSettlement: Settlement | null` de `BalanceCard` : passer de
    // null à une valeur, puis revenir à null, doit se refléter les deux fois.
    render(createElement(NullableProbe, { serverValue: null }));
    expect(displayed()).toBe("vide");

    render(createElement(NullableProbe, { serverValue: [{ id: "x" }] }));
    expect(displayed()).toBe("x");

    render(createElement(NullableProbe, { serverValue: null }));
    expect(displayed()).toBe("vide");
  });
});
