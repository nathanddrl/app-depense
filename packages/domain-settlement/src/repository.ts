// @app/domain-settlement — PORT de persistance (inversion de dépendance).
//
// Le domaine définit l'interface dont il a besoin ; il ne connaît ni Supabase ni
// les cookies. L'implémentation concrète `SupabaseSettlementRepository` vit dans
// @app/db et satisfait ce port STRUCTURELLEMENT (typage structurel TS, sans
// `implements` ni import de domain-*) — @app/db reste une feuille. Les tests
// injectent un fake en mémoire. Toutes les opérations sont déjà scopées au foyer
// courant (le repo porte le client authentifié → la RLS s'applique au runtime).

import type { Settlement } from "./types";

/** Champs figés au déclenchement (ch.5.3, T-C6.2). */
export type NewSettlement = {
  householdId: string;
  amountCents: number;
  fromMemberId: string;
  toMemberId: string;
  initiatedBy: string;
};

export interface SettlementRepository {
  /** Régularisation `pending` existante du foyer, s'il y en a une (une seule à la fois, D16). */
  getPendingSettlement(householdId: string): Promise<{ id: string } | null>;

  /** Création du settlement `pending`. Ne touche plus aux dépenses (modèle ledger, D7 révisé) : le solde restant est recalculé dynamiquement. */
  createSettlement(newSettlement: NewSettlement): Promise<Settlement>;

  /** Lecture pour confirmation/annulation (null si absente/hors périmètre RLS). */
  getSettlementById(settlementId: string): Promise<Settlement | null>;

  /** `pending → confirmed` : simple update de statut. */
  confirmSettlement(settlementId: string, confirmedBy: string): Promise<Settlement>;

  /** `pending → cancelled` : simple update de statut, plus de dé-stamp (D7 révisé). */
  cancelSettlement(settlementId: string): Promise<Settlement>;

  /** Règlements `confirmed` du foyer (D15 révisé) : ajustements du solde ledger + historique "pourquoi ?". */
  listConfirmedSettlements(householdId: string): Promise<Settlement[]>;
}
