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
import { createExpenseAction } from "./actions";
import type { Expense } from "@app/domain-expense";
import type { Category } from "@app/domain-expense";
import { formatAmountEUR, formatDateFr } from "@app/shared";
import type { MemberShare } from "../lib/household";
import { AidSection } from "./aid-section";

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

/** Dépense optimiste : montant + libellé visibles, parts absentes tant que le serveur n'a pas répondu. */
type OptimisticExpense =
  Expense | { id: string; label: string; grossCents: number; incurredOn: string; pending: true };

export function ExpensesPanel({ currentMemberId, initialExpenses, defaultShares }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [optimisticExpenses, addOptimistic] = useOptimistic<OptimisticExpense[], OptimisticExpense>(
    expenses,
    (state, next) => [next, ...state],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customShares, setCustomShares] = useState(false);

  const otherMembers = defaultShares.filter((m) => m.memberId !== currentMemberId);

  function handleSubmit(formData: FormData) {
    setError(null);
    const label = String(formData.get("label") ?? "").trim();
    const amountEUR = String(formData.get("amount") ?? "");
    const category = String(formData.get("category") ?? "autre") as Category;
    const incurredOn = String(formData.get("incurredOn") ?? today());
    const grossCents = Math.round(Number.parseFloat(amountEUR.replace(",", ".")) * 100);

    const shares = customShares
      ? defaultShares.map((m) => ({
          memberId: m.memberId,
          pct: Number(formData.get(`pct-${m.memberId}`) ?? 0),
        }))
      : defaultShares.map((m) => ({ memberId: m.memberId, pct: m.defaultSharePct }));

    const tempId = `temp-${crypto.randomUUID()}`;

    startTransition(async () => {
      addOptimistic({ id: tempId, label, grossCents, incurredOn, pending: true });

      const result = await createExpenseAction({
        label,
        category,
        grossCents,
        payerId: currentMemberId,
        incurredOn,
        shares,
      });

      if (result.ok) {
        setExpenses((prev) => [result.data, ...prev]);
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <section>
      <form action={handleSubmit}>
        <label>
          Libellé
          <input type="text" name="label" required />
        </label>
        <label>
          Montant (€)
          <input type="text" name="amount" inputMode="decimal" required placeholder="800" />
        </label>
        <label>
          Catégorie
          <select name="category" defaultValue="autre">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" name="incurredOn" defaultValue={today()} required />
        </label>

        <details>
          <summary>Options</summary>
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
        </details>

        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={isPending}>
          {isPending ? "Ajout…" : "Ajouter"}
        </button>
      </form>

      <ul>
        {optimisticExpenses.map((e) => (
          <li key={e.id}>
            <strong>{e.label}</strong> — {formatAmountEUR(e.grossCents)} —{" "}
            {formatDateFr(new Date(e.incurredOn))}
            {"pending" in e && e.pending ? " (en attente…)" : null}
            {"shares" in e
              ? e.shares
                  .filter((s) => s.memberId !== currentMemberId)
                  .map((s) => {
                    const member = otherMembers.find((m) => m.memberId === s.memberId);
                    return (
                      <span key={s.memberId}>
                        {" "}
                        — Part de {member?.displayName ?? "l'autre"} : {formatAmountEUR(s.cents)}
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
                onSharesUpdated={(shares) =>
                  setExpenses((prev) => prev.map((x) => (x.id === e.id ? { ...x, shares } : x)))
                }
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
