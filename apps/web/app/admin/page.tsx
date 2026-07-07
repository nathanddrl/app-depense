// Vue admin brute des dépenses (T-C8.2, DA14) : consultation + correction d'une
// dépense verrouillée (T-C8.3). Aucun terme de vocabulaire membre à respecter
// ici (§8.1 ne s'applique qu'aux écrans membres).

import { getCurrentContext } from "../../lib/auth/context";
import { getAdminExpenseOverviewAction } from "../actions";
import { getDefaultShares } from "../../lib/household";
import { AdminExpenseTable } from "./admin-expense-table";

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

  return (
    <main>
      <h1>Administration — dépenses (vue brute)</h1>
      <AdminExpenseTable initialLines={overviewResult.data} members={members} />
    </main>
  );
}
