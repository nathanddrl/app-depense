// Tests du builder PUR d'export (T-EXPORT1). On prouve : montants NUMÉRIQUES en
// euros (pas des chaînes formatées), exactitude des sommes (catégorie/mois/parts),
// 4 feuilles présentes, feuille évolution à une ligne par mois (1 mois → 1 ligne),
// et nommage du fichier. Aucun accès Supabase : le builder est isolé.

import { describe, it, expect } from "vitest";
import {
  buildExportWorkbook,
  exportFileName,
  type ExportData,
  type ExportMember,
} from "./workbook";

const A: ExportMember = { memberId: "mA", displayName: "Alice" };
const B: ExportMember = { memberId: "mB", displayName: "Bob" };

/** Jeu de données : 2 mois, parts 60/40, une aide, un règlement confirmé. */
function sampleData(months: string[]): ExportData {
  const expenses = [
    {
      incurredOn: "2026-06-05",
      label: "Loyer juin",
      category: "loyer",
      grossCents: 80000,
      payerId: "mA",
      settlementId: null,
      shares: [
        { memberId: "mA", cents: 48000 },
        { memberId: "mB", cents: 32000 },
      ],
      aids: [] as { beneficiaryId: string; label: string; amountCents: number }[],
    },
    {
      incurredOn: "2026-06-12",
      label: "Courses",
      category: "courses",
      grossCents: 5000,
      payerId: "mB",
      settlementId: null,
      shares: [
        { memberId: "mA", cents: 3000 },
        { memberId: "mB", cents: 2000 },
      ],
      aids: [{ beneficiaryId: "mA", label: "CAF", amountCents: 1000 }],
    },
    {
      incurredOn: "2026-07-03",
      label: "Loyer juillet",
      category: "loyer",
      grossCents: 80000,
      payerId: "mA",
      settlementId: null,
      shares: [
        { memberId: "mA", cents: 48000 },
        { memberId: "mB", cents: 32000 },
      ],
      aids: [],
    },
  ];
  return {
    months,
    members: [A, B],
    expenses: expenses.filter((e) => months.includes(e.incurredOn.slice(0, 7))),
    settlements: [
      {
        fromMemberId: "mB",
        toMemberId: "mA",
        amountCents: 32000,
        status: "confirmed",
        initiatedAt: "2026-07-10T09:00:00Z",
        confirmedAt: "2026-07-11T10:00:00Z",
      },
    ],
  };
}

describe("exportFileName", () => {
  it("un seul mois → etale-export-<mois>.xlsx", () => {
    expect(exportFileName(["2026-07"])).toBe("etale-export-2026-07.xlsx");
  });

  it("plusieurs mois → premier_dernier", () => {
    expect(exportFileName(["2026-06", "2026-07"])).toBe("etale-export-2026-06_2026-07.xlsx");
  });
});

describe("buildExportWorkbook — structure", () => {
  it("génère exactement les 4 feuilles attendues", () => {
    const wb = buildExportWorkbook(sampleData(["2026-06", "2026-07"]));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Dépenses",
      "Résumé par catégorie",
      "Évolution mensuelle",
      "Aides et régularisations",
    ]);
  });
});

describe("buildExportWorkbook — feuille Dépenses", () => {
  it("montants numériques en euros (pas des chaînes) et parts par membre", () => {
    const wb = buildExportWorkbook(sampleData(["2026-06"]));
    const ws = wb.getWorksheet("Dépenses")!;
    // Ligne 1 = en-têtes ; ligne 2 = première dépense (Loyer juin).
    const row = ws.getRow(2);
    // Colonnes : 1 Date, 2 Libellé, 3 Catégorie, 4 Montant brut, 5 Payeur,
    // 6 Part Alice, 7 Part Bob, 8 Statut.
    expect(row.getCell(4).value).toBe(800); // 80000 cents → 800 €, NUMÉRIQUE
    expect(typeof row.getCell(4).value).toBe("number");
    expect(row.getCell(5).value).toBe("Alice"); // payeur résolu en nom
    expect(row.getCell(6).value).toBe(480); // part Alice 48000 cents
    expect(row.getCell(7).value).toBe(320); // part Bob 32000 cents
    expect(row.getCell(8).value).toBe("—"); // pas de settlementId (modèle ledger)
  });
});

describe("buildExportWorkbook — Résumé par catégorie", () => {
  it("somme brute par catégorie sur tous les mois cochés", () => {
    const wb = buildExportWorkbook(sampleData(["2026-06", "2026-07"]));
    const ws = wb.getWorksheet("Résumé par catégorie")!;
    const rows: Record<string, unknown> = {};
    ws.eachRow((r, n) => {
      if (n === 1) return; // en-tête
      rows[String(r.getCell(1).value)] = r.getCell(2).value;
    });
    expect(rows["loyer"]).toBe(1600); // 80000 + 80000 → 1600 €
    expect(rows["courses"]).toBe(50); // 5000 → 50 €
  });
});

describe("buildExportWorkbook — Évolution mensuelle", () => {
  it("un seul mois coché → une seule ligne de données", () => {
    const wb = buildExportWorkbook(sampleData(["2026-06"]));
    const ws = wb.getWorksheet("Évolution mensuelle")!;
    expect(ws.rowCount).toBe(2); // en-tête + 1 ligne
    const row = ws.getRow(2);
    expect(row.getCell(2).value).toBe(850); // total juin 80000+5000 → 850 €
    expect(row.getCell(3).value).toBe(510); // part Alice 48000+3000 → 510 €
    expect(row.getCell(4).value).toBe(340); // part Bob 32000+2000 → 340 €
  });

  it("deux mois cochés → deux lignes", () => {
    const wb = buildExportWorkbook(sampleData(["2026-06", "2026-07"]));
    const ws = wb.getWorksheet("Évolution mensuelle")!;
    expect(ws.rowCount).toBe(3); // en-tête + 2 lignes
  });
});

describe("buildExportWorkbook — Aides et régularisations", () => {
  it("liste l'aide perçue et le règlement confirmé, montants numériques", () => {
    const wb = buildExportWorkbook(sampleData(["2026-06", "2026-07"]));
    const ws = wb.getWorksheet("Aides et régularisations")!;
    const cells: unknown[] = [];
    ws.eachRow((r) => r.eachCell((c) => cells.push(c.value)));
    expect(cells).toContain("CAF"); // libellé de l'aide
    expect(cells).toContain(10); // aide 1000 cents → 10 €
    expect(cells).toContain(320); // règlement 32000 cents → 320 €
    expect(cells).toContain("confirmed");
  });
});
