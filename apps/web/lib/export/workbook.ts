// Génération PURE du classeur d'export (T-EXPORT1). Aucun I/O, aucun accès
// Supabase : cette fonction reçoit des données déjà normalisées et renvoie un
// classeur ExcelJS → testable en isolation (workbook.test.ts). La Route Handler
// (`app/api/export/route.ts`) reste un wrapper fin qui assemble les données puis
// délègue ici (convention CLAUDE.md : les routes ne portent aucune logique).
//
// Règle montants (DoD) : les cellules de montant sont NUMÉRIQUES en euros
// (`cents / 100`) avec un format de cellule monétaire — jamais les chaînes
// `formatAmountEUR`, pour rester triables/calculables par l'utilisateur.

import ExcelJS from "exceljs";

const MONEY_FMT = '#,##0.00 €';
const DATE_FMT = "dd/mm/yyyy";

/** Membre du foyer, résolu id → nom en amont (jamais un id brut dans le fichier). */
export type ExportMember = { memberId: string; displayName: string };

/** Une dépense normalisée pour l'export (parts figées + aides embarquées). */
export type ExportExpense = {
  incurredOn: string; // `YYYY-MM-DD`
  label: string;
  category: string;
  grossCents: number;
  payerId: string;
  settlementId: string | null;
  shares: { memberId: string; cents: number }[];
  aids: { beneficiaryId: string; label: string; amountCents: number }[];
};

/** Un règlement normalisé pour l'export (confirmé ou en attente sur la période). */
export type ExportSettlement = {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  status: string; // 'pending' | 'confirmed'
  initiatedAt: string; // ISO
  confirmedAt: string | null; // ISO
};

export type ExportData = {
  months: string[]; // `YYYY-MM`, triés ascendant
  members: ExportMember[];
  expenses: ExportExpense[]; // sur les mois sélectionnés, ordre chronologique décroissant
  settlements: ExportSettlement[]; // déjà filtrés à la période par l'appelant
};

/** Centimes entiers → euros numériques (2 décimales exactes, pas de flottant parasite). */
function toEuros(cents: number): number {
  return Math.round(cents) / 100;
}

/** `"2026-07-09"` → Date UTC (jamais `new Date(string)`, qui décale selon le fuseau). */
function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** `"2026-07"` → « juillet 2026 » (dupliqué de date-label pour garder ce module pur). */
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** Nom d'un membre, ou l'id brut en dernier recours (jamais vide → traçable). */
function nameOf(members: ExportMember[], memberId: string): string {
  return members.find((m) => m.memberId === memberId)?.displayName ?? memberId;
}

/** Statut de régularisation d'une dépense (legacy `settlementId`, modèle ledger). */
function settlementStatusLabel(settlementId: string | null): string {
  return settlementId ? "régularisée" : "—";
}

/**
 * Nom du fichier téléchargé (DoD) : `etale-export-<mois>.xlsx` si un seul mois,
 * `etale-export-<premier>_<dernier>.xlsx` sinon. `months` est supposé trié ascendant.
 */
export function exportFileName(months: string[]): string {
  if (months.length === 1) return `etale-export-${months[0]}.xlsx`;
  const first = months[0];
  const last = months[months.length - 1];
  return `etale-export-${first}_${last}.xlsx`;
}

/** Met en gras la première ligne (en-têtes) d'une feuille. */
function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true };
}

export function buildExportWorkbook(data: ExportData): ExcelJS.Workbook {
  const { months, members, expenses, settlements } = data;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Étale";
  wb.created = new Date();

  buildExpensesSheet(wb, members, expenses);
  buildCategorySummarySheet(wb, expenses);
  buildMonthlyEvolutionSheet(wb, months, members, expenses);
  buildAidsAndSettlementsSheet(wb, members, expenses, settlements);

  return wb;
}

/** Feuille « Dépenses » — une ligne par dépense, part de chaque membre en colonnes. */
function buildExpensesSheet(
  wb: ExcelJS.Workbook,
  members: ExportMember[],
  expenses: ExportExpense[],
): void {
  const ws = wb.addWorksheet("Dépenses");

  const header = [
    "Date",
    "Libellé",
    "Catégorie",
    "Montant brut",
    "Payeur",
    ...members.map((m) => `Part ${m.displayName}`),
    "Statut de régularisation",
  ];
  styleHeader(ws.addRow(header));

  // Indices (1-based) des colonnes monétaires : montant brut (4) + une par membre.
  const moneyCols = [4, ...members.map((_, i) => 6 + i)];
  const dateCol = 1;

  for (const e of expenses) {
    const shareByMember = new Map(e.shares.map((s) => [s.memberId, s.cents]));
    ws.addRow([
      parseYmd(e.incurredOn),
      e.label,
      e.category,
      toEuros(e.grossCents),
      nameOf(members, e.payerId),
      ...members.map((m) => toEuros(shareByMember.get(m.memberId) ?? 0)),
      settlementStatusLabel(e.settlementId),
    ]);
  }

  ws.getColumn(dateCol).numFmt = DATE_FMT;
  for (const c of moneyCols) ws.getColumn(c).numFmt = MONEY_FMT;
  autoSize(ws, header.length);
}

/** Feuille « Résumé par catégorie » — total brut par catégorie sur tous les mois cochés. */
function buildCategorySummarySheet(wb: ExcelJS.Workbook, expenses: ExportExpense[]): void {
  const ws = wb.addWorksheet("Résumé par catégorie");
  styleHeader(ws.addRow(["Catégorie", "Total"]));

  const totals = new Map<string, number>();
  for (const e of expenses) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.grossCents);
  }

  for (const [category, cents] of totals) {
    ws.addRow([category, toEuros(cents)]);
  }

  ws.getColumn(2).numFmt = MONEY_FMT;
  autoSize(ws, 2);
}

/** Feuille « Évolution mensuelle » — une ligne par mois coché (total + part par membre). */
function buildMonthlyEvolutionSheet(
  wb: ExcelJS.Workbook,
  months: string[],
  members: ExportMember[],
  expenses: ExportExpense[],
): void {
  const ws = wb.addWorksheet("Évolution mensuelle");

  const header = ["Mois", "Total dépensé", ...members.map((m) => `Part ${m.displayName}`)];
  styleHeader(ws.addRow(header));

  for (const month of months) {
    const ofMonth = expenses.filter((e) => e.incurredOn.slice(0, 7) === month);
    const total = ofMonth.reduce((sum, e) => sum + e.grossCents, 0);
    const partByMember = members.map((m) =>
      ofMonth.reduce(
        (sum, e) => sum + (e.shares.find((s) => s.memberId === m.memberId)?.cents ?? 0),
        0,
      ),
    );
    ws.addRow([monthLabel(month), toEuros(total), ...partByMember.map(toEuros)]);
  }

  // Colonnes monétaires : total (2) + une par membre.
  for (let c = 2; c <= header.length; c++) ws.getColumn(c).numFmt = MONEY_FMT;
  autoSize(ws, header.length);
}

/** Feuille « Aides et régularisations » — deux blocs empilés. */
function buildAidsAndSettlementsSheet(
  wb: ExcelJS.Workbook,
  members: ExportMember[],
  expenses: ExportExpense[],
  settlements: ExportSettlement[],
): void {
  const ws = wb.addWorksheet("Aides et régularisations");

  // Bloc 1 — aides perçues (aplaties depuis les dépenses).
  styleHeader(ws.addRow(["Aides perçues"]));
  styleHeader(ws.addRow(["Date dépense", "Libellé dépense", "Bénéficiaire", "Libellé aide", "Montant"]));
  for (const e of expenses) {
    for (const aid of e.aids) {
      ws.addRow([
        parseYmd(e.incurredOn),
        e.label,
        nameOf(members, aid.beneficiaryId),
        aid.label,
        toEuros(aid.amountCents),
      ]);
    }
  }

  ws.addRow([]); // séparateur

  // Bloc 2 — régularisations (confirmées + éventuelle en attente sur la période).
  const settlementsHeaderRowStart = ws.rowCount + 1;
  styleHeader(ws.addRow(["Régularisations"]));
  styleHeader(ws.addRow(["De", "Vers", "Montant", "Statut", "Date initiée", "Date confirmée"]));
  for (const s of settlements) {
    ws.addRow([
      nameOf(members, s.fromMemberId),
      nameOf(members, s.toMemberId),
      toEuros(s.amountCents),
      s.status,
      new Date(s.initiatedAt),
      s.confirmedAt ? new Date(s.confirmedAt) : "",
    ]);
  }

  // Formats : colonne Montant (5) du bloc aides ET colonne Montant (3) du bloc
  // régularisations partagent la grille ; on applique par cellule pour ne pas
  // mélanger les deux tableaux qui n'ont pas les mêmes colonnes.
  applyPerCellFormats(ws, settlementsHeaderRowStart);
  autoSize(ws, 6);
}

/**
 * Les deux tableaux de la feuille 4 ont des colonnes différentes ; on formate
 * donc au cas par cas plutôt que par colonne entière : dates et montants selon
 * le bloc (aides : Date=1, Montant=5 ; régularisations : Montant=3, Dates=5/6).
 */
function applyPerCellFormats(ws: ExcelJS.Worksheet, settlementsHeaderRowStart: number): void {
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < settlementsHeaderRowStart) {
      // Bloc aides (en-têtes inclus, numFmt sur cellule texte = inoffensif).
      row.getCell(1).numFmt = DATE_FMT;
      row.getCell(5).numFmt = MONEY_FMT;
    } else {
      // Bloc régularisations.
      row.getCell(3).numFmt = MONEY_FMT;
      row.getCell(5).numFmt = DATE_FMT;
      row.getCell(6).numFmt = DATE_FMT;
    }
  });
}

/** Largeur de colonne approximative depuis le contenu (lisibilité, best-effort). */
function autoSize(ws: ExcelJS.Worksheet, columnCount: number): void {
  for (let c = 1; c <= columnCount; c++) {
    const col = ws.getColumn(c);
    let max = 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value == null ? 0 : String(cell.value).length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 40);
  }
}
