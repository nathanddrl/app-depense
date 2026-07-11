"use client";

// Historique filtrable, regroupé par date (uiuix-guide/mainpage.zip,
// HistorySection.jsx — signalé dans son commentaire comme absent du plan de dev
// initial). Filtrage entièrement client sur la liste déjà chargée par
// `listExpensesAction()` (pas de nouvel aller-retour serveur).
//
// Regroupement par `incurredOn` (chaîne `YYYY-MM-DD`) et clé de mois
// (`incurredOn.slice(0, 7)`) dérivés directement de la chaîne — jamais via
// `new Date(dateString)`, qui décale selon le fuseau du navigateur. Même
// précaution que `nextMonth` (packages/db/src/expense-repository.ts).
//
// L'aide après coup (`AidSection`) reste disponible par ligne, derrière une
// disclosure « options » — capacité déjà existante, simplement nichée ici.
//
// `expense.source` (T-CR3, spec 8.1) : badge discret sur les lignes générées
// par une charge récurrente, même traitement visuel que « en attente… » —
// jamais une couleur d'alerte, ce n'est pas une anomalie. Rien n'est affiché
// pour `source='manual'` (le défaut reste silencieux).

import { useMemo, useState } from "react";
import type { Category, Expense } from "@app/domain-expense";
import { formatAmountEUR } from "@app/shared";
import type { MemberShare } from "../../../lib/household";
import { CATEGORIES, categoryLabelOf } from "./categories";
import { dayLabel } from "./date-label";
import { AidSection } from "./aid-section";
import { Card } from "../design-system/core";
import { CategoryChip, AmountDisplay } from "../design-system/balance";
import { Tabs, WaterSeparator } from "../design-system/navigation";
import { Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";

/** Dépense optimiste : montant + libellé visibles, parts absentes tant que le
 * serveur n'a pas répondu (même contrat que l'ancien `expenses-panel.tsx`). */
export type HistoryExpense =
  | Expense
  | {
      id: string;
      label: string;
      category: Category;
      grossCents: number;
      incurredOn: string;
      pending: true;
    };

type Props = {
  expenses: HistoryExpense[];
  currentMemberId: string;
  defaultShares: MemberShare[];
  onSharesUpdated: (expenseId: string, shares: Expense["shares"]) => void;
};

function monthKeyOf(incurredOn: string): string {
  return incurredOn.slice(0, 7);
}

/** `"2026-07"` → « juillet » (UTC forcé : la chaîne n'a pas d'heure, éviter tout
 * décalage de fuseau en construisant la date depuis les composants, pas `new
 * Date(string)`). */
function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(date);
}

export function HistorySection({
  expenses,
  currentMemberId,
  defaultShares,
  onSharesUpdated,
}: Props) {
  const [month, setMonth] = useState("tous");
  const [category, setCategory] = useState<"toutes" | Category>("toutes");

  const monthItems = useMemo(() => {
    const keys = Array.from(new Set(expenses.map((e) => monthKeyOf(e.incurredOn)))).sort((a, b) =>
      b.localeCompare(a),
    );
    return [{ value: "tous", label: "tous" }, ...keys.map((key) => ({ value: key, label: monthLabel(key) }))];
  }, [expenses]);

  const categoryItems = [
    { value: "toutes", label: "toutes" },
    ...CATEGORIES.map((c) => ({ value: c.value, label: c.label.toLowerCase() })),
  ];

  const filtered = expenses.filter(
    (e) =>
      (month === "tous" || monthKeyOf(e.incurredOn) === month) &&
      (category === "toutes" || e.category === category),
  );

  const groups: { date: string; items: HistoryExpense[] }[] = [];
  for (const e of filtered) {
    let group = groups.find((g) => g.date === e.incurredOn);
    if (!group) {
      group = { date: e.incurredOn, items: [] };
      groups.push(group);
    }
    group.items.push(e);
  }

  return (
    <Card>
      <Stack gap={3}>
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            letterSpacing: "var(--tracking-title)",
          }}
        >
          mouvements
        </span>

        <Tabs items={monthItems} active={month} onChange={setMonth} />
        <Tabs
          items={categoryItems}
          active={category}
          onChange={(value) => setCategory(value as "toutes" | Category)}
        />

        {groups.length === 0 ? <Notice>rien à afficher pour ce filtre</Notice> : null}

        {groups.map((group) => (
          <Stack gap={2} key={group.date}>
            <WaterSeparator label={dayLabel(group.date)} />
            {group.items.map((e) => (
              <Stack gap={1} key={e.id}>
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
                    <span>{e.label}</span>
                    {"pending" in e && e.pending ? (
                      <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                        en attente…
                      </span>
                    ) : null}
                    {"source" in e && e.source === "recurring" ? (
                      <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                        dépense qui revient chaque mois
                      </span>
                    ) : null}
                  </div>
                  <AmountDisplay value={formatAmountEUR(e.grossCents)} size="sm" />
                </div>

                {"shares" in e ? (
                  <AidSection
                    expenseId={e.id}
                    grossCents={e.grossCents}
                    category={e.category}
                    currentMemberId={currentMemberId}
                    members={defaultShares}
                    initialAids={e.aids}
                    onSharesUpdated={(shares) => onSharesUpdated(e.id, shares)}
                  />
                ) : null}
              </Stack>
            ))}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
