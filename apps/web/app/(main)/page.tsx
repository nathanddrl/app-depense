import Link from "next/link";
import { getCurrentContext } from "../../lib/auth/context";
import { getDefaultShares } from "../../lib/household";
import { signOut, listExpensesAction, listRecurringTemplatesAction } from "../actions";
import { BalancePanel } from "../_components/balance/balance-panel";
import { FirstExpenseInvite } from "../_components/home/first-expense-invite";
import { RecurrenceInvite } from "../_components/home/recurrence-invite";
import { AddExpenseButton } from "../_components/home/add-expense-button";
import { MovementsList } from "../_components/expenses/movements-list";
import { Button } from "../_components/design-system/core";
import { Stack } from "../_components/design-system/layout";

// Le seam résout le membre + le foyer courant (via le JWT/RLS) ; le proxy
// redirige déjà les visiteurs non authentifiés vers /login.
export default async function Home() {
  const ctx = await getCurrentContext();
  const [expensesResult, templatesResult, defaultShares] = await Promise.all([
    listExpensesAction(),
    listRecurringTemplatesAction(),
    getDefaultShares(ctx.supabase, ctx.householdId),
  ]);

  // États vides orientés action (spec 8.6, T-C9.1) : pas d'invitation si
  // l'appel a échoué — on n'affirme rien sur un état inconnu.
  const showFirstExpenseInvite = expensesResult.ok && expensesResult.data.length === 0;
  const showRecurrenceInvite = templatesResult.ok && templatesResult.data.length === 0;
  // Déjà trié du plus récent au plus ancien par le repo (`order incurred_on
  // desc`) — pas de nouveau tri ici, juste l'extrait (CN2.2).
  const recentExpenses = expensesResult.ok ? expensesResult.data.slice(0, 3) : [];

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
        <AddExpenseButton />
        {recentExpenses.length > 0 ? (
          <MovementsList expenses={recentExpenses} members={defaultShares} />
        ) : null}
        {showFirstExpenseInvite ? <FirstExpenseInvite /> : null}
        {showRecurrenceInvite ? <RecurrenceInvite /> : null}

        <form action={signOut}>
          <Button type="submit" variant="secondary">
            se déconnecter
          </Button>
        </form>
      </Stack>
    </main>
  );
}
