// @app/domain-settlement — baril public. Orchestration régularisation double
// approbation (spec ch.5.3, D16 v0.3). T-C6.1 a posé le package et la machine à
// états ; T-C6.2 a ajouté initiateSettlement ; T-C6.3 a ajouté
// confirmSettlement/cancelSettlement ; T-C6.6 ajoute getCurrentSettlement
// (lecture pour l'UI web).

export { canTransitionSettlement, validateSettlementTransition } from "./transitions";
export { initiateSettlement } from "./initiate-settlement";
export { confirmSettlement } from "./confirm-settlement";
export { cancelSettlement } from "./cancel-settlement";
export { getCurrentSettlement } from "./get-current-settlement";

export type { SettlementRepository, NewSettlement } from "./repository";

export type {
  SettlementStatus,
  Settlement,
  SettlementContext,
  InitiateSettlementInput,
  ConfirmSettlementInput,
  CancelSettlementInput,
} from "./types";
