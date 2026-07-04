// @app/shared — placeholder de squelette (aucune logique métier).
// Accueillera : ActionResult/AppError/AppWarning (spec ch.6.1), enums (D18),
// et le formatage centralisé montant/date (DA10).
//
// DA10 : centraliser le formatage ici plutôt que des toFixed/toLocaleDateString
// dispersés. Signatures réservées, implémentation à venir.

export function formatAmountEUR(_cents: number): string {
  throw new Error("not implemented");
}

export function formatDateFr(_date: Date): string {
  throw new Error("not implemented");
}
