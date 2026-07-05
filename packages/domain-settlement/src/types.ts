// @app/domain-settlement — types du domaine (spec ch.5.3, D16 v0.3).

/** Statut d'un settlement : double approbation, transitions gardées (transitions.ts). */
export type SettlementStatus = "pending" | "confirmed" | "cancelled";

/** Vue domaine d'un settlement, miroir camelCase de la table `settlement`. */
export type Settlement = {
  id: string;
  householdId: string;
  status: SettlementStatus;
  amountCents: number;
  fromMemberId: string;
  toMemberId: string;
  initiatedBy: string;
  initiatedAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
};
