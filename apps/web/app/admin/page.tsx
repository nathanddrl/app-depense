// Vue admin brute des dépenses (T-C8.2, DA14) : consultation seule, aucun terme
// de vocabulaire membre à respecter ici (§8.1 ne s'applique qu'aux écrans membres).

import { getCurrentContext } from "../../lib/auth/context";
import { getAdminExpenseOverviewAction } from "../actions";
import { getDefaultShares } from "../../lib/household";
import { formatAmountEUR, formatDateFr } from "@app/shared";

function statusLabel(deletedAt: string | null, settlementId: string | null): string {
  if (deletedAt) return "supprimée";
  if (settlementId) return "verrouillée";
  return "active";
}

export default async function AdminPage() {
  const ctx = await getCurrentContext();
  const [overviewResult, members] = await Promise.all([
    getAdminExpenseOverviewAction(),
    getDefaultShares(ctx.supabase, ctx.householdId),
  ]);

  if (!overviewResult.ok) {
    return (
      <main>
        <h1>Administration — dépenses</h1>
        <p role="alert">{overviewResult.error.message}</p>
      </main>
    );
  }

  const nameOf = (memberId: string) =>
    members.find((m) => m.memberId === memberId)?.displayName ?? memberId;

  return (
    <main>
      <h1>Administration — dépenses (vue brute)</h1>
      <table>
        <thead>
          <tr>
            <th>Libellé</th>
            <th>Catégorie</th>
            <th>Date</th>
            <th>Brut</th>
            <th>Payeur</th>
            <th>Statut</th>
            <th>Décomposition</th>
          </tr>
        </thead>
        <tbody>
          {overviewResult.data.map((line) => (
            <tr key={line.id}>
              <td>{line.label}</td>
              <td>{line.category}</td>
              <td>{formatDateFr(new Date(line.incurredOn))}</td>
              <td>{formatAmountEUR(line.grossCents)}</td>
              <td>{nameOf(line.payerId)}</td>
              <td>{statusLabel(line.deletedAt, line.settlementId)}</td>
              <td>
                <div>
                  base : {formatAmountEUR(line.baseOwedCents)} ({nameOf(line.otherId)} → {nameOf(line.payerId)})
                </div>
                {line.aidLines.map((aid, i) => (
                  <div key={i}>
                    {aid.label} : {formatAmountEUR(aid.aidCents)} (part {formatAmountEUR(aid.sharedCents)})
                  </div>
                ))}
                <strong>total dû : {formatAmountEUR(line.totalOwedCents)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
