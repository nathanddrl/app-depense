import { getCurrentContext } from "../lib/auth/context";
import { getDefaultShares } from "../lib/household";
import { signOut, listExpensesAction } from "./actions";
import { ExpensesPanel } from "./_components/expenses/expenses-panel";
import { BalancePanel } from "./_components/balance/balance-panel";

// Le seam résout le membre + le foyer courant (via le JWT/RLS) ; le middleware
// redirige déjà les visiteurs non authentifiés vers /login.
export default async function Home() {
  const ctx = await getCurrentContext();
  const [expensesResult, defaultShares] = await Promise.all([
    listExpensesAction(),
    getDefaultShares(ctx.supabase, ctx.householdId),
  ]);

  return (
    <main>
      <h1>Étale</h1>
      <p>
        Connecté en tant que <strong>{ctx.member.displayName}</strong>.
      </p>
      <BalancePanel currentMemberId={ctx.member.id} members={defaultShares} />
      <ExpensesPanel
        currentMemberId={ctx.member.id}
        initialExpenses={expensesResult.ok ? expensesResult.data : []}
        defaultShares={defaultShares}
      />
      <form action={signOut}>
        <button type="submit">Se déconnecter</button>
      </form>
    </main>
  );
}
