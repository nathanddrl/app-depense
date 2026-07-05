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

  /** Création atomique du settlement `pending` + gel (`settlement_id`) des dépenses ouvertes du foyer. */
  createSettlementAndFreezeExpenses(newSettlement: NewSettlement): Promise<Settlement>;
}
