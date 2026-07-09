"use client";

// Saisie + liste des dépenses (spec ch.5.1, 8.4). Optimistic UI : la dépense
// apparaît immédiatement, rollback silencieux si le serveur refuse. On n'affiche
// PAS de parts calculées côté client pour l'entrée optimiste — calc-engine reste
// la seule source de calcul, même à l'affichage ; les parts n'apparaissent qu'au
// retour serveur.
//
// Vocabulaire strict (spec 8.1) : "Montant", "Partage", "Ta part" / "Part de X" —
// jamais "brut", "ratio", "payeur", "part figée".

import { useOptimistic, useState, useTransition } from "react";
import { createExpenseAction } from "../../actions";
import type { Expense } from "@app/domain-expense";
import type { Category } from "@app/domain-expense";
import { formatAmountEUR, formatDateFr } from "@app/shared";
import type { MemberShare } from "../../../lib/household";
import { AidSection } from "./aid-section";
import { Button, Card, Input } from "../design-system/core";
import { CategoryChip, AmountDisplay } from "../design-system/balance";
import { Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import nativeSelectStyles from "../design-system/core/native-select.module.css";

type Props = {
  currentMemberId: string;
  initialExpenses: Expense[];
  defaultShares: MemberShare[];
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "loyer", label: "Loyer" },
  { value: "courses", label: "Courses" },
  { value: "charges", label: "Charges" },
  { value: "sorties", label: "Sorties" },
  { value: "autre", label: "Autre" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function categoryLabelOf(value: Category): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Dépense optimiste : montant + libellé visibles, parts absentes tant que le serveur n'a pas répondu. */
type OptimisticExpense =
  | Expense
  | {
      id: string;
      label: string;
      category: Category;
      grossCents: number;
      incurredOn: string;
      pending: true;
    };

export function ExpensesPanel({ currentMemberId, initialExpenses, defaultShares }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [optimisticExpenses, addOptimistic] = useOptimistic<OptimisticExpense[], OptimisticExpense>(
    expenses,
    (state, next) => [next, ...state],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customShares, setCustomShares] = useState(false);

  // État contrôlé requis par `Input` (design-system/core, T-CD2.2) — pas de prop
  // `name` disponible dessus, donc plus de lecture via FormData pour ces champs.
  // Le formulaire natif se vidait automatiquement après soumission (comportement
  // par défaut des actions de <form> sur des champs non contrôlés) : on reproduit
  // ce reset explicitement après un ajout réussi pour ne rien changer côté UX.
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("autre");
  const [incurredOn, setIncurredOn] = useState(today());

  const otherMembers = defaultShares.filter((m) => m.memberId !== currentMemberId);

  function handleSubmit(formData: FormData) {
    setError(null);
    const trimmedLabel = label.trim();
    const grossCents = Math.round(Number.parseFloat(amount.replace(",", ".")) * 100);

    const shares = customShares
      ? defaultShares.map((m) => ({
          memberId: m.memberId,
          pct: Number(formData.get(`pct-${m.memberId}`) ?? 0),
        }))
      : defaultShares.map((m) => ({ memberId: m.memberId, pct: m.defaultSharePct }));

    const tempId = `temp-${crypto.randomUUID()}`;

    startTransition(async () => {
      addOptimistic({
        id: tempId,
        label: trimmedLabel,
        category,
        grossCents,
        incurredOn,
        pending: true,
      });

      const result = await createExpenseAction({
        label: trimmedLabel,
        category,
        grossCents,
        payerId: currentMemberId,
        incurredOn,
        shares,
      });

      if (result.ok) {
        setExpenses((prev) => [result.data, ...prev]);
        setLabel("");
        setAmount("");
        setCategory("autre");
        setIncurredOn(today());
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <section>
      {/* Card (T-CD2.2) : les composants du kit (AmountDisplay/Button/...) ne
          fixent que du texte/fond via des tokens sémantiques — sans surface
          explicite, ils héritent du fond de page (non stylé, cf. base.css) et
          perdent tout contraste en thème sombre (`data-theme="dark"`, layout.tsx).
          Même solution que balance-panel.tsx (T-CD2.1). */}
      <Card>
        <Stack gap={3}>
          <form action={handleSubmit}>
            <Stack gap={2}>
              <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input
                label="Montant"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="800"
                suffix="€"
              />
              <Stack direction="row" gap={2} wrap>
                <div style={{ flex: "1 1 200px" }}>
                  <label className={nativeSelectStyles.wrapper}>
                    <span className={nativeSelectStyles.label}>Catégorie</span>
                    <select
                      className={nativeSelectStyles.select}
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Category)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <CategoryChip name={categoryLabelOf(category)} size={24} />
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <Input
                    type="date"
                    label="Date"
                    value={incurredOn}
                    onChange={(e) => setIncurredOn(e.target.value)}
                    required
                  />
                </div>
              </Stack>

              <details>
                <summary>Options</summary>
                <Stack gap={1}>
                  <p>Partage</p>
                  <label>
                    <input
                      type="checkbox"
                      checked={customShares}
                      onChange={(e) => setCustomShares(e.target.checked)}
                    />
                    Personnaliser le partage pour cette dépense
                  </label>
                  {customShares
                    ? defaultShares.map((m) => (
                        <label key={m.memberId}>
                          {m.memberId === currentMemberId ? "Toi" : m.displayName}
                          <input
                            type="number"
                            name={`pct-${m.memberId}`}
                            defaultValue={m.defaultSharePct}
                            min={0}
                            max={100}
                          />
                          %
                        </label>
                      ))
                    : null}
                </Stack>
              </details>

              {error ? <Notice tone="error">{error}</Notice> : null}
              <Button type="submit" disabled={isPending}>
                {isPending ? "Ajout…" : "Ajouter"}
              </Button>
            </Stack>
          </form>

          <ul>
            {optimisticExpenses.map((e) => (
              <li key={e.id} style={{ marginTop: "var(--space-2)" }}>
                <CategoryChip name={categoryLabelOf(e.category)} size={20} />{" "}
                <strong>{e.label}</strong> — <AmountDisplay value={formatAmountEUR(e.grossCents)} />{" "}
                — {formatDateFr(new Date(e.incurredOn))}
                {"pending" in e && e.pending ? " (en attente…)" : null}
                {"shares" in e
                  ? e.shares
                      .filter((s) => s.memberId !== currentMemberId)
                      .map((s) => {
                        const member = otherMembers.find((m) => m.memberId === s.memberId);
                        return (
                          <span key={s.memberId}>
                            {" "}
                            — Part de {member?.displayName ?? "l'autre"} :{" "}
                            <AmountDisplay value={formatAmountEUR(s.cents)} />
                          </span>
                        );
                      })
                  : null}
                {"shares" in e ? (
                  <AidSection
                    expenseId={e.id}
                    grossCents={e.grossCents}
                    currentMemberId={currentMemberId}
                    members={defaultShares}
                    initialAids={e.aids}
                    onSharesUpdated={(shares) =>
                      setExpenses((prev) => prev.map((x) => (x.id === e.id ? { ...x, shares } : x)))
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </Stack>
      </Card>
    </section>
  );
}
