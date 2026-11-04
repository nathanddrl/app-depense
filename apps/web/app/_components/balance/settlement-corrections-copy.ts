// Libellé d'une correction faite après le dernier règlement, partagé par le
// relevé (`balance-statement.tsx`) et son repli (`balance-breakdown.tsx`) :
// une seule copie du texte produit, pour qu'il ne diverge jamais.

import { formatAmountEUR } from "@app/shared";
import type { SettlementCorrectionLine } from "@app/domain-expense";

export function correctionAction(c: SettlementCorrectionLine): string {
  if (c.kind === "added") return "ajoutée après coup";
  if (c.kind === "deleted") return "retirée après coup";
  if (c.kind === "aid-added") return `aide de ${formatAmountEUR(c.amountCents)} ajoutée après coup`;
  if (c.previousAmountCents !== undefined) {
    return `modifiée après coup, de ${formatAmountEUR(c.previousAmountCents)} à ${formatAmountEUR(c.amountCents)}`;
  }
  return "modifiée après coup";
}
