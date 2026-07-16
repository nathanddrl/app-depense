"use client";

// Partie client de la carte de solde (T-CF1/T-CF2) : reçoit le solde/règlement
// initial du Server Component parent (`BalancePanel`, chargement de page),
// puis détient l'état local affiché. Le rafraîchit par fetch ciblé
// (`getBalanceAction` + `getCurrentSettlementAction`, jamais `router.refresh`)
// dans trois cas : une action de régularisation dans cette carte elle-même
// (`SettlementControls`), une mutation ailleurs sur la page qui touche le
// solde (dépense/aide créée-éditée-supprimée, notifiée via le bus
// `data-refresh-bus`), ou un retour au premier plan de l'app après une mise en
// arrière-plan (`useVisibilityRefresh`).
//
// Dérivations (debtor/creditor, phrase, magnitude WaterLine) reprises telles
// quelles de l'ancien `BalancePanel` (RSC) — formatage pur, aucun calcul
// financier (calc-engine reste seul habilité, DA4).

import { useCallback, useEffect, useState } from "react";
import { getBalanceAction, getCurrentSettlementAction } from "../../actions";
import { formatAmountEUR } from "@app/shared";
import type { Balance } from "@app/domain-expense";
import type { Settlement } from "@app/domain-settlement";
import { memberDisplayName, type MemberShare } from "../../../lib/household";
import { subscribeDataChanged } from "../data-refresh/data-refresh-bus";
import { useVisibilityRefresh } from "../data-refresh/use-visibility-refresh";
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
  initialBalance: Balance;
  initialSettlement: Settlement | null;
};

export function BalanceCard({ currentMemberId, members, initialBalance, initialSettlement }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [settlement, setSettlement] = useState(initialSettlement);

  const refresh = useCallback(() => {
    void (async () => {
      const [balanceResult, settlementResult] = await Promise.all([
        getBalanceAction(),
        getCurrentSettlementAction(),
      ]);
      if (balanceResult.ok) setBalance(balanceResult.data);
      if (settlementResult.ok) setSettlement(settlementResult.data);
    })();
  }, []);

  useEffect(() => subscribeDataChanged("balance", refresh), [refresh]);
  useVisibilityRefresh(refresh);

  const { from, to, amountCents } = balance;

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
      onSettled={refresh}
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
