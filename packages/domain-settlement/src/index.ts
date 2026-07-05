// @app/domain-settlement — baril public. Orchestration régularisation double
// approbation (spec ch.5.3, D16 v0.3). T-C6.1 a posé le package et la machine à
// états ; T-C6.2 ajoute initiateSettlement. confirmSettlement/cancelSettlement
// suivent en T-C6.3.

export { canTransitionSettlement, validateSettlementTransition } from "./transitions";
export { initiateSettlement } from "./initiate-settlement";

export type { SettlementRepository, NewSettlement } from "./repository";

export type {
  SettlementStatus,
  Settlement,
  SettlementContext,
  InitiateSettlementInput,
} from "./types";
