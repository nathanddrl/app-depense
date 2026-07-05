// @app/shared — baril public. Contrat d'interface (ch.6.1/6.3), formatage
// centralisé montant/date (DA10), validations de forme transverses (ch.7).
// Aucune logique métier, aucun couplage framework/DB.

export type { ActionResult, AppError, AppWarning, ErrorCode, WarningCode } from "./contract";
export { ok, err } from "./contract";

export { formatAmountEUR, formatDateFr } from "./format";

export {
  validateAmountCents,
  validateRatio,
  validateIncurredOn,
  validateDayOfMonth,
  validateLabel,
  firstError,
} from "./validation";
