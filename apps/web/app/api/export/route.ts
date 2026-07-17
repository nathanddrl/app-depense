// Route Handler export Excel (T-EXPORT1) — GET `?mois=2026-06,2026-07`.
//
// CONTRAIREMENT à `api/cron/recurring/route.ts` (service_role, aucun JWT), cette
// route est sur le CHEMIN UTILISATEUR : `getCurrentContext()` porte le JWT du
// membre → la RLS scope automatiquement au foyer courant. Aucun service_role ici.
//
// Wrapper fin (convention CLAUDE.md) : assemble les données via les fonctions
// domaine existantes (aucune réimplémentation), puis délègue la mise en forme au
// builder pur `lib/export/workbook.ts`. Les totaux par catégorie/mois sont de
// simples sommes de présentation calculées côté web (jamais dans calc-engine).

import {
  SupabaseExpenseRepository,
  SupabaseSettlementRepository,
} from "@app/db";
import { listExpenses, listExpenseMonths } from "@app/domain-expense";
import { getCurrentContext } from "../../../lib/auth/context";
import { getDefaultShares } from "../../../lib/household";
import {
  buildExportWorkbook,
  exportFileName,
  type ExportExpense,
  type ExportSettlement,
} from "../../../lib/export/workbook";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Mois d'un timestamp ISO en `YYYY-MM` (UTC), pour filtrer les règlements. */
function isoMonth(iso: string): string {
  return iso.slice(0, 7);
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await getCurrentContext();
  const domainCtx = { memberId: ctx.member.id, householdId: ctx.householdId };

  // Mois demandés, intersectés avec les mois RÉELS (garde : on n'exporte jamais
  // un mois hors périmètre ou sans dépense). Tri ascendant pour le nommage et la
  // feuille évolution.
  const requested = new URL(request.url).searchParams.get("mois");
  const requestedMonths = (requested ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const expenseRepo = new SupabaseExpenseRepository(ctx.supabase);
  const monthsResult = await listExpenseMonths(expenseRepo, domainCtx);
  const realMonths = monthsResult.ok ? monthsResult.data : [];
  const months = requestedMonths.filter((m) => realMonths.includes(m)).sort();

  if (months.length === 0) {
    return Response.json({ error: "Aucun mois valide sélectionné." }, { status: 400 });
  }

  // Membres du foyer (id → nom), réutilisé pour payeur / bénéficiaire / parts.
  const members = await getDefaultShares(ctx.supabase, ctx.householdId);

  // Dépenses des mois sélectionnés (parts figées + aides embarquées).
  const expenses: ExportExpense[] = [];
  for (const month of months) {
    const res = await listExpenses(expenseRepo, domainCtx, { month });
    if (!res.ok) continue;
    for (const e of res.data) {
      expenses.push({
        incurredOn: e.incurredOn,
        label: e.label,
        category: e.category,
        grossCents: e.grossCents,
        payerId: e.payerId,
        settlementId: e.settlementId,
        shares: e.shares.map((s) => ({ memberId: s.memberId, cents: s.cents })),
        aids: e.aids.map((a) => ({
          beneficiaryId: a.beneficiaryId,
          label: a.label,
          amountCents: a.amountCents,
        })),
      });
    }
  }

  // Règlements de la période : confirmés (par mois de confirmation, sinon
  // d'initiation) + éventuelle régularisation en attente (au plus une, D16) si
  // initiée sur la période. Les règlements ne sont pas rattachés à un mois de
  // dépense (modèle ledger) : on filtre donc sur leurs propres dates.
  const settlementRepo = new SupabaseSettlementRepository(ctx.supabase);
  const confirmed = await settlementRepo.listConfirmedSettlements(ctx.householdId);
  const pending = await settlementRepo.getPendingSettlement(ctx.householdId);
  const pendingFull = pending ? await settlementRepo.getSettlementById(pending.id) : null;

  const inPeriod = (iso: string): boolean => months.includes(isoMonth(iso));
  const settlements: ExportSettlement[] = [];
  for (const s of confirmed) {
    const ref = s.confirmedAt ?? s.initiatedAt;
    if (inPeriod(ref)) {
      settlements.push({
        fromMemberId: s.fromMemberId,
        toMemberId: s.toMemberId,
        amountCents: s.amountCents,
        status: s.status,
        initiatedAt: s.initiatedAt,
        confirmedAt: s.confirmedAt,
      });
    }
  }
  if (pendingFull && inPeriod(pendingFull.initiatedAt)) {
    settlements.push({
      fromMemberId: pendingFull.fromMemberId,
      toMemberId: pendingFull.toMemberId,
      amountCents: pendingFull.amountCents,
      status: pendingFull.status,
      initiatedAt: pendingFull.initiatedAt,
      confirmedAt: pendingFull.confirmedAt,
    });
  }

  const wb = buildExportWorkbook({
    months,
    members: members.map((m) => ({ memberId: m.memberId, displayName: m.displayName })),
    expenses,
    settlements,
  });
  const buffer = await wb.xlsx.writeBuffer();
  const filename = exportFileName(months);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
