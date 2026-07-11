import type { Expense } from "@app/domain-expense";

// Regroupement contigu (liste déjà triée desc par `incurredOn` côté repo) :
// un seul passage, pas de `Map`/`find` — clé de jour ou de mois selon l'appelant.
function groupByKey(expenses: Expense[], keyOf: (e: Expense) => string): { key: string; items: Expense[] }[] {
  const groups: { key: string; items: Expense[] }[] = [];
  for (const e of expenses) {
    const key = keyOf(e);
    const current = groups[groups.length - 1];
    if (current?.key === key) {
      current.items.push(e);
    } else {
      groups.push({ key, items: [e] });
    }
  }
  return groups;
}

export function groupByDay(expenses: Expense[]): { key: string; items: Expense[] }[] {
  return groupByKey(expenses, (e) => e.incurredOn);
}

export function groupByMonth(expenses: Expense[]): { key: string; items: Expense[] }[] {
  return groupByKey(expenses, (e) => e.incurredOn.slice(0, 7));
}
