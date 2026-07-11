// Carte de solde (spec 8.1, D-UX2) : solde nu en une phrase neutre + détail
// dépliable à la demande (8.3, T-C4.4). Vocabulaire strict : jamais "solde",
// "dette", "créance", "retard" — juste qui doit quoi à qui. Le parcours
// « Solder » (8.1/5.3, T-C6.6) s'y greffe : la carte affiche aussi la
// régularisation `pending` courante s'il y en a une.

import { getBalanceAction, getCurrentSettlementAction } from "../../actions";
import { formatAmountEUR } from "@app/shared";
import { memberDisplayName, type MemberShare } from "../../../lib/household";
import { BalanceDetailToggle } from "./balance-detail-toggle";
import { BalanceNetworkGate } from "./balance-network-gate";
import { SettlementControls } from "./settlement-controls";
import { waterLineMagnitude } from "./water-line-magnitude";
import { Card } from "../design-system/core";
import { BalanceStatement, WaterLine } from "../design-system/balance";
import { Stack } from "../design-system/layout";

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

  const { from, to, amountCents } = balanceResult.data;

  // Débiteur/créancier dérivés du settlement en cours s'il y en a un — plus
  // fiable que le solde courant, qui peut avoir bougé depuis le déclenchement
  // (nouvelles dépenses ouvertes pendant que la régularisation est pending).
  const debtorId = settlement?.fromMemberId ?? from;
  const creditorId = settlement?.toMemberId ?? to;
  const debtorName = memberDisplayName(members, debtorId);
  const creditorName = memberDisplayName(members, creditorId);

  const settlementControls = (
    <SettlementControls
      currentMemberId={currentMemberId}
      debtorId={debtorId}
      debtorName={debtorName}
      creditorName={creditorName}
      settlement={settlement}
      amountCents={amountCents}
    />
  );

  if (amountCents === 0) {
    return (
      <BalanceNetworkGate>
        <Card>
          <Stack gap={2}>
            <BalanceStatement>vous êtes étale</BalanceStatement>
            <WaterLine magnitude={0} />
            {settlementControls}
          </Stack>
        </Card>
      </BalanceNetworkGate>
    );
  }

  const isCreditor = to === currentMemberId;
  const otherMemberId = isCreditor ? from : to;
  const otherName = memberDisplayName(members, otherMemberId);
  const amount = formatAmountEUR(amountCents);
  const message = isCreditor
    ? `${otherName} te doit ${amount}`
    : `tu dois ${amount} à ${otherName}`;

  return (
    <BalanceNetworkGate>
      <Card>
        <Stack gap={2}>
          <BalanceStatement>{message}</BalanceStatement>
          <WaterLine magnitude={waterLineMagnitude(amountCents, isCreditor)} />
          <BalanceDetailToggle
            currentMemberId={currentMemberId}
            otherDisplayName={otherName}
            totalMessage={message}
          />
          {settlementControls}
        </Stack>
      </Card>
    </BalanceNetworkGate>
  );
}
