import { getCurrentContext } from "../lib/auth/context";
import { getDefaultShares } from "../lib/household";
import { signOut, listExpensesAction } from "./actions";
import { ExpensesPanel } from "./_components/expenses/expenses-panel";
import { BalancePanel } from "./_components/balance/balance-panel";
import { Button } from "./_components/design-system/core";
import { Stack, PageTitle } from "./_components/design-system/layout";

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
      <Stack gap={6}>
        <Stack gap={4}>
          <Stack gap={1}>
            <PageTitle>Étale</PageTitle>
            <p style={{ color: "var(--text-secondary)" }}>
              Connecté en tant que <strong>{ctx.member.displayName}</strong>.
            </p>
          </Stack>
          <BalancePanel currentMemberId={ctx.member.id} members={defaultShares} />
          <ExpensesPanel
            currentMemberId={ctx.member.id}
            initialExpenses={expensesResult.ok ? expensesResult.data : []}
            defaultShares={defaultShares}
          />
        </Stack>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Se déconnecter
          </Button>
        </form>
      </Stack>
    </main>
  );
}
