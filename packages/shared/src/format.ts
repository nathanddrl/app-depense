// @app/shared — formatage centralisé montant/date (DA10).
//
// Seule précaution retenue contre l'absence de next-intl (archi ch.3.2) :
// centraliser ici plutôt que des toFixed/toLocaleDateString dispersés dans les
// composants. Fonctions pures. Argent en centimes entiers (D transverse), dates
// métier raisonnées en Europe/Paris (D4).

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const dateFr = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// Locale "en-CA" formate en `YYYY-MM-DD`, directement comparable à `incurred_on`.
const isoDateParis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Formate un montant en centimes entiers vers un libellé euro FR (ex. 80000 → « 800,00 € »). */
export function formatAmountEUR(cents: number): string {
  return eur.format(cents / 100);
}

/** Formate une date vers « jj/mm/aaaa » en heure de Paris (ex. 2026-07-04 → « 04/07/2026 »). */
export function formatDateFr(date: Date): string {
  return dateFr.format(date);
}

/** Date du jour en `YYYY-MM-DD`, heure de Paris (D4) — borne pour exclure les dépenses futures du solde (4.2). */
export function getTodayParis(): string {
  return isoDateParis.format(new Date());
}
