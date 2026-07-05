// Carte de solde (spec 8.1, D-UX2) : solde nu en une phrase neutre + détail
// dépliable à la demande (8.3, T-C4.4). Vocabulaire strict : jamais "solde",
// "dette", "créance", "retard" — juste qui doit quoi à qui.

import { getBalanceAction } from "./actions";
import { formatAmountEUR } from "@app/shared";
import type { MemberShare } from "../lib/household";
import { BalanceDetailToggle } from "./balance-detail-toggle";

type Props = {
  currentMemberId: string;
  members: MemberShare[];
};

function displayNameOf(members: MemberShare[], memberId: string): string {
  return members.find((m) => m.memberId === memberId)?.displayName ?? "";
}

export async function BalancePanel({ currentMemberId, members }: Props) {
  const result = await getBalanceAction();
  if (!result.ok) return null;

  const { from, to, amountCents } = result.data;

  if (amountCents === 0) {
    return <p>Vous êtes à jour</p>;
  }

  const message =
    to === currentMemberId
      ? `${displayNameOf(members, from)} te doit ${formatAmountEUR(amountCents)}`
      : `Tu dois ${formatAmountEUR(amountCents)} à ${displayNameOf(members, to)}`;

  const otherMemberId = to === currentMemberId ? from : to;

  return (
    <div>
      <p>{message}</p>
      <BalanceDetailToggle
        currentMemberId={currentMemberId}
        otherDisplayName={displayNameOf(members, otherMemberId)}
        totalMessage={message}
      />
    </div>
  );
}
