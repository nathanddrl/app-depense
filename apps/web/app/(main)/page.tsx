import { getCurrentContext } from "../../lib/auth/context";
import { getDefaultShares } from "../../lib/household";
import { listExpensesAction, listRecurringTemplatesAction } from "../actions";
import { BalancePanel } from "../_components/balance/balance-panel";
import { RecurrenceInvite } from "../_components/home/recurrence-invite";
import { AddExpenseButton } from "../_components/home/add-expense-button";
import { HomeExpensesPreview } from "../_components/home/home-expenses-preview";
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
  // l'appel a échoué — on n'affirme rien sur un état inconnu. Le choix
  // initial "aucune dépense" vs aperçu est ensuite tenu à jour côté client
  // par `HomeExpensesPreview` (suppression jusqu'à 0, hors DoD T-CF3).
  const showRecurrenceInvite = templatesResult.ok && templatesResult.data.length === 0;
  // Déjà trié du plus récent au plus ancien par le repo (`order incurred_on
  // desc`) — pas de nouveau tri ici, juste l'extrait (CN2.2).
  const recentExpenses = expensesResult.ok ? expensesResult.data.slice(0, 3) : [];

  return (
    <main>
      <Stack gap={4}>
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

        <BalancePanel currentMemberId={ctx.member.id} members={defaultShares} />
        <AddExpenseButton />
        {expensesResult.ok ? (
          <HomeExpensesPreview
            initialExpenses={recentExpenses}
            members={defaultShares}
            currentMemberId={ctx.member.id}
          />
        ) : null}
        {showRecurrenceInvite ? <RecurrenceInvite /> : null}
      </Stack>
    </main>
  );
}
