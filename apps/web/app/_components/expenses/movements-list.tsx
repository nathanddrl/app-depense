// Liste compacte de mouvements (CN2.2) : flux typographique direct sur
// --surface-base, séparé par des filets WaterSeparator — jamais de Card par
// ligne ni autour du bloc. Motif posé ici de façon réutilisable : l'écran
// mouvements complet (T-CN3.1, pas encore construit) reprendra la même ligne
// (CategoryChip, payeur, date, montant), potentiellement sur la liste entière
// plutôt qu'un extrait.

import type { Expense } from "@app/domain-expense";
import { formatAmountEUR } from "@app/shared";
import type { MemberShare } from "../../../lib/household";
import { categoryLabelOf } from "./categories";
import { dayLabel } from "./date-label";
import { CategoryChip, AmountDisplay } from "../design-system/balance";
import { WaterSeparator } from "../design-system/navigation";
import { Stack } from "../design-system/layout";

type Props = {
  expenses: Expense[];
  members: MemberShare[];
};

function displayNameOf(members: MemberShare[], memberId: string): string {
  return members.find((m) => m.memberId === memberId)?.displayName ?? "";
}

export function MovementsList({ expenses, members }: Props) {
  return (
    <Stack gap={1}>
      {expenses.map((e) => (
        <Stack gap={1} key={e.id}>
          <WaterSeparator />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <CategoryChip name={categoryLabelOf(e.category)} size={28} />
              <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                {displayNameOf(members, e.payerId)} · {dayLabel(e.incurredOn)}
              </span>
            </div>
            <AmountDisplay value={formatAmountEUR(e.grossCents)} size="sm" />
          </div>
        </Stack>
      ))}
    </Stack>
  );
}
