// Liste compacte de mouvements (CN2.2) : flux typographique direct sur
// --surface-base, séparé par des filets WaterSeparator étiquetés — jamais de
// Card par ligne ni autour du bloc. Groupé par jour comme HistorySection (même
// `dayLabel`) : un seul séparateur si l'extrait tient sur un jour, un par jour
// sinon. Motif posé ici de façon réutilisable : l'écran mouvements complet
// (T-CN3.1, pas encore construit) reprendra la même ligne (CategoryChip,
// catégorie, payeur, montant), potentiellement sur la liste entière plutôt
// qu'un extrait.

import { Fragment } from "react";
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

function groupByDay(expenses: Expense[]): { date: string; items: Expense[] }[] {
  const groups: { date: string; items: Expense[] }[] = [];
  for (const e of expenses) {
    const current = groups[groups.length - 1];
    if (current?.date === e.incurredOn) {
      current.items.push(e);
    } else {
      groups.push({ date: e.incurredOn, items: [e] });
    }
  }
  return groups;
}

export function MovementsList({ expenses, members }: Props) {
  const groups = groupByDay(expenses);

  return (
    <Stack gap={3}>
      {groups.map((group) => (
        <Stack gap={2} key={group.date}>
          <WaterSeparator label={dayLabel(group.date)} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              rowGap: "var(--space-2)",
              columnGap: "var(--space-2)",
            }}
          >
            {group.items.map((e) => (
              <Fragment key={e.id}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                  <CategoryChip name={categoryLabelOf(e.category)} size={28} />
                  <span>{categoryLabelOf(e.category).toLowerCase()}</span>
                </div>
                <span style={{ color: "var(--text-secondary)" }}>
                  {displayNameOf(members, e.payerId)}
                </span>
                <span style={{ justifySelf: "end" }}>
                  <AmountDisplay value={formatAmountEUR(e.grossCents)} size="sm" />
                </span>
              </Fragment>
            ))}
          </div>
        </Stack>
      ))}
    </Stack>
  );
}
