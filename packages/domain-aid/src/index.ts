// @app/domain-aid — baril public. Orchestration des aides rattachées aux
// dépenses (spec ch.5.2). Importe calc-engine + shared, jamais un autre
// domain-*. Ne réimplémente aucun calcul (DA4) : parts figées via calc-engine.

export { addAid } from "./add-aid";
export { removeAid } from "./remove-aid";

export type { AidRepository, NewAid, ExpenseForAid } from "./repository";

export type {
  AidContext,
  AddAidInput,
  RemoveAidInput,
  AidDTO,
  ExpenseShareDTO,
  Expense,
} from "./types";
