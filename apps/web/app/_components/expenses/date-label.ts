// Libellé de date court pour une dépense (`incurredOn`, chaîne `YYYY-MM-DD`),
// partagé entre l'historique filtrable et l'aperçu accueil. Construction
// depuis les composants de la chaîne (jamais `new Date(string)`, qui décale
// selon le fuseau du navigateur) — même précaution que `nextMonth`
// (packages/db/src/expense-repository.ts).

/** `"2026-07-09"` → « 9 juillet ». */
export function dayLabel(incurredOn: string): string {
  const [year, month, day] = incurredOn.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    date,
  );
}
