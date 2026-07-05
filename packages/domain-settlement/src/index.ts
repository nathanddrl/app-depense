// @app/domain-settlement — baril public. Orchestration régularisation double
// approbation (spec ch.5.3, D16 v0.3). Cette carte (T-C6.1) pose le package et
// la machine à états ; les actions initiateSettlement/confirmSettlement/
// cancelSettlement suivent en T-C6.2/T-C6.3.

export { canTransitionSettlement, validateSettlementTransition } from "./transitions";

export type { SettlementStatus, Settlement } from "./types";
