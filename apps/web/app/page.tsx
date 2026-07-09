import Link from "next/link";
import { getCurrentContext } from "../lib/auth/context";
import { getDefaultShares } from "../lib/household";
import { signOut, listExpensesAction } from "./actions";
import { ExpensesPanel } from "./_components/expenses/expenses-panel";
import { BalancePanel } from "./_components/balance/balance-panel";
import { Button } from "./_components/design-system/core";
import { WaterSeparator } from "./_components/design-system/navigation";
import { Stack } from "./_components/design-system/layout";

// Le seam résout le membre + le foyer courant (via le JWT/RLS) ; le proxy
// redirige déjà les visiteurs non authentifiés vers /login.
export default async function Home() {
  const ctx = await getCurrentContext();
  const [expensesResult, defaultShares] = await Promise.all([
    listExpensesAction(),
    getDefaultShares(ctx.supabase, ctx.householdId),
  ]);

  return (
    <main>
      <Stack gap={4}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          {/* Wordmark (uiuix-guide/03-typographie.md) : Fraunces italique,
              bas-de-casse, jamais un logo ni le composant PageTitle générique
              (réservé aux titres d'écran, ex. /admin, /login). */}
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: "var(--display-sm)",
              color: "var(--text-primary)",
            }}
          >
            étale
          </span>
          <Link href="/recurrence" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            charges récurrentes
          </Link>
        </div>

        <BalancePanel currentMemberId={ctx.member.id} members={defaultShares} />
        <WaterSeparator />
        <ExpensesPanel
          currentMemberId={ctx.member.id}
          initialExpenses={expensesResult.ok ? expensesResult.data : []}
          defaultShares={defaultShares}
        />

        <form action={signOut}>
          <Button type="submit" variant="secondary">
            se déconnecter
          </Button>
        </form>
      </Stack>
    </main>
  );
}
