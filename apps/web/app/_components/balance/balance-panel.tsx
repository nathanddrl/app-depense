// Carte de solde (spec 8.1, D-UX2) : solde nu en une phrase neutre + détail
// dépliable à la demande (8.3, T-C4.4). Vocabulaire strict : jamais "solde",
// "dette", "créance", "retard" — juste qui doit quoi à qui. Le parcours
// « Solder » (8.1/5.3, T-C6.6) s'y greffe : la carte affiche aussi la
// régularisation `pending` courante s'il y en a une.
//
// Ce composant serveur ne fait que le chargement initial (T-CF1/T-CF2) — tout
// le rafraîchissement ultérieur (après une action locale, une mutation
// ailleurs sur la page, ou un retour au premier plan) est délégué à
// `BalanceCard`, qui détient l'état local et rejoue `getBalanceAction` /
// `getCurrentSettlementAction` sans jamais passer par `router.refresh()`.

import { getBalanceAction, getCurrentSettlementAction } from "../../actions";
import type { MemberShare } from "../../../lib/household";
import { BalanceCard } from "./balance-card";

type Props = {
  currentMemberId: string;
  members: MemberShare[];
};

export async function BalancePanel({ currentMemberId, members }: Props) {
  const [balanceResult, settlementResult] = await Promise.all([
    getBalanceAction(),
    getCurrentSettlementAction(),
  ]);
  if (!balanceResult.ok) return null;
  const settlement = settlementResult.ok ? settlementResult.data : null;

  return (
    <BalanceCard
      currentMemberId={currentMemberId}
      members={members}
      initialBalance={balanceResult.data}
      initialSettlement={settlement}
    />
  );
}
