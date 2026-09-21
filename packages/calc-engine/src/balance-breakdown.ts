import type { MemberId } from "./types";

/**
 * Une dépense active, pour la décomposition « ce qui a été payé » (écran
 * donut, refonte solde). Volontairement PLAT (aucun ratio/aide) : cette
 * décomposition représente le brut payé, pas des parts — grandeur distincte
 * du solde (encodage assumé, cf. compte-rendu de la refonte).
 */
export interface PaidExpenseInput {
  id: string;
  label: string;
  category: string;
  grossCents: number;
  payerId: MemberId;
  /** Date métier `YYYY-MM-DD` — distingue à l'écran des dépenses de même libellé. */
  incurredOn: string;
}

/** Une dépense au sein d'une catégorie, triée par montant décroissant. */
export interface PaidExpenseLine {
  id: string;
  label: string;
  cents: number;
  incurredOn: string;
}

/** Le total payé d'un membre pour une catégorie, et le détail des dépenses qui le composent. */
export interface CategoryPaidBreakdown {
  category: string;
  totalCents: number;
  expenses: PaidExpenseLine[];
}

/** Le total payé d'un membre sur la période, décomposé par catégorie. */
export interface MemberPaidBreakdown {
  memberId: MemberId;
  totalCents: number;
  categories: CategoryPaidBreakdown[];
}

/**
 * Décompose un ensemble de dépenses actives en « ce que chacun a payé »,
 * par membre puis par catégorie (écran donut, refonte solde). Fonction pure :
 * aucune connaissance de la période/du filtrage, aucune E/S — l'appelant
 * (domain-expense) fournit déjà les dépenses actives de la période voulue.
 *
 * Tri déterministe (catégories/dépenses par montant décroissant, égalité
 * départagée par libellé) : nécessaire pour que le donut recompose ses arcs
 * de façon stable d'un rendu à l'autre.
 */
export function computePaidBreakdown(
  expenses: PaidExpenseInput[],
  memberIds: MemberId[],
): MemberPaidBreakdown[] {
  const byMember = new Map<MemberId, Map<string, PaidExpenseLine[]>>();
  for (const memberId of memberIds) byMember.set(memberId, new Map());

  for (const expense of expenses) {
    const categories = byMember.get(expense.payerId);
    if (!categories) continue; // payeur hors du foyer courant : ignoré, défensif.
    const lines = categories.get(expense.category) ?? [];
    lines.push({
      id: expense.id,
      label: expense.label,
      cents: expense.grossCents,
      incurredOn: expense.incurredOn,
    });
    categories.set(expense.category, lines);
  }

  return memberIds.map((memberId) => {
    const categories: CategoryPaidBreakdown[] = [...(byMember.get(memberId)?.entries() ?? [])]
      .map(([category, lines]) => ({
        category,
        totalCents: lines.reduce((sum, line) => sum + line.cents, 0),
        expenses: lines.slice().sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category));

    return {
      memberId,
      totalCents: categories.reduce((sum, c) => sum + c.totalCents, 0),
      categories,
    };
  });
}
