"use client";

// Liste compacte de mouvements (CN2.2) : flux typographique direct sur
// --surface-base, séparé par des filets WaterSeparator étiquetés — jamais de
// Card par ligne ni autour du bloc. Groupé par jour par défaut (aperçu
// accueil, un seul séparateur si l'extrait tient sur un jour) ou par mois
// (`groupBy="month"`, écran /mouvements complet, T-CN3.1 — un historique de
// plusieurs mois est plus lisible avec un repère mensuel qu'un filet par
// jour). Badge « dépense qui revient chaque mois » (source==='recurring',
// T-CR3) : même traitement visuel que dans l'ancien HistorySection, ton
// neutre, jamais une couleur d'alerte.
//
// Édition d'aide après coup (T-CN5, ex-`history-section.tsx` mort depuis
// T-CN3.1) : `AidSection` se réaffiche sur une ligne loyer non verrouillée,
// même logique interne intacte (restriction catégorie, garde EXPENSE_LOCKED
// server-side) — ce composant se contente de ne PAS monter `AidSection` du
// tout pour une dépense verrouillée (`settlementId !== null`) ou hors loyer,
// pour que le point d'entrée n'existe même pas plutôt que d'échouer après coup.
// `AidSection` porte déjà sa propre disclosure repliée ("options"), pas de
// nouvel état ici — juste `router.refresh()` pour que le solde affiché
// ailleurs (accueil) reflète la nouvelle aide au retour.

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Expense } from "@app/domain-expense";
import { formatAmountEUR } from "@app/shared";
import { memberDisplayName, type MemberShare } from "../../../lib/household";
import { categoryLabelOf } from "./categories";
import { dayLabel, monthLabel } from "./date-label";
import { groupByDay, groupByMonth } from "./group-expenses";
import { AidSection } from "./aid-section";
import { CategoryChip, AmountDisplay } from "../design-system/balance";
import { WaterSeparator } from "../design-system/navigation";
import { Stack } from "../design-system/layout";

type Props = {
  expenses: Expense[];
  members: MemberShare[];
  currentMemberId: string;
  groupBy?: "day" | "month";
  showLabel?: boolean;
};

export function MovementsList({
  expenses,
  members,
  currentMemberId,
  groupBy = "day",
  showLabel = false,
}: Props) {
  const router = useRouter();
  const groups = groupBy === "month" ? groupByMonth(expenses) : groupByDay(expenses);
  const labelOf = groupBy === "month" ? monthLabel : dayLabel;

  return (
    <Stack gap={3}>
      {groups.map((group) => (
        <Stack gap={2} key={group.key}>
          <WaterSeparator label={labelOf(group.key)} />
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
                {showLabel ? (
                  <span style={{ gridColumn: "1 / -1", fontWeight: 500 }}>{e.label}</span>
                ) : null}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                  <CategoryChip name={categoryLabelOf(e.category)} size={28} />
                  <span>{categoryLabelOf(e.category).toLowerCase()}</span>
                </div>
                <span style={{ color: "var(--text-secondary)" }}>
                  {memberDisplayName(members, e.payerId)}
                </span>
                <span style={{ justifySelf: "end" }}>
                  <AmountDisplay value={formatAmountEUR(e.grossCents)} size="sm" />
                </span>
                {e.source === "recurring" ? (
                  <span
                    style={{
                      gridColumn: "1 / -1",
                      color: "var(--text-secondary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    dépense qui revient chaque mois
                  </span>
                ) : null}
                {e.category === "loyer" && e.settlementId === null ? (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <AidSection
                      expenseId={e.id}
                      grossCents={e.grossCents}
                      category={e.category}
                      currentMemberId={currentMemberId}
                      members={members}
                      initialAids={e.aids}
                      onSharesUpdated={() => router.refresh()}
                    />
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        </Stack>
      ))}
    </Stack>
  );
}
