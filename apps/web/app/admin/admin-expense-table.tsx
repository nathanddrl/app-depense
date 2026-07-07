"use client";

// Table admin brute (T-C8.2) + édition inline (T-C8.3, DA14). L'admin est seul
// utilisateur de cet écran : pas de vocabulaire membre à respecter (§8.1),
// formulaire minimal (libellé/montant/date), pas de sur-ingénierie.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminUpdateExpenseAction } from "../actions";
import type { AdminExpenseOverviewLine } from "@app/domain-expense";
import { formatAmountEUR, formatDateFr } from "@app/shared";
import type { MemberShare } from "../../lib/household";

type Props = {
  initialLines: AdminExpenseOverviewLine[];
  members: MemberShare[];
};

function statusLabel(deletedAt: string | null, settlementId: string | null): string {
  if (deletedAt) return "supprimée";
  if (settlementId) return "verrouillée";
  return "active";
}

export function AdminExpenseTable({ initialLines: lines, members }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameOf = (memberId: string) =>
    members.find((m) => m.memberId === memberId)?.displayName ?? memberId;

  function handleSubmit(line: AdminExpenseOverviewLine, formData: FormData) {
    setError(null);
    const label = String(formData.get("label") ?? "").trim();
    const amountEUR = String(formData.get("amount") ?? "");
    const grossCents = Math.round(Number.parseFloat(amountEUR.replace(",", ".")) * 100);
    const incurredOn = String(formData.get("incurredOn") ?? line.incurredOn);

    startTransition(async () => {
      const result = await adminUpdateExpenseAction({
        expenseId: line.id,
        patch: { label, grossCents, incurredOn },
      });
      if (result.ok) {
        // La décomposition (base/total dû) est calculée par calc-engine côté
        // serveur (DA4) : on ne la recalcule jamais côté client, on rafraîchit
        // le Server Component pour obtenir la ligne à jour au lieu de patcher
        // un sous-ensemble de champs (ce qui laisserait la décomposition périmée).
        router.refresh();
        setEditingId(null);
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Libellé</th>
            <th>Catégorie</th>
            <th>Date</th>
            <th>Brut</th>
            <th>Payeur</th>
            <th>Statut</th>
            <th>Décomposition</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) =>
            editingId === line.id ? (
              <tr key={line.id}>
                <td colSpan={8}>
                  <form action={(formData) => handleSubmit(line, formData)}>
                    <label>
                      Libellé
                      <input type="text" name="label" defaultValue={line.label} required />
                    </label>
                    <label>
                      Montant (€)
                      <input
                        type="text"
                        name="amount"
                        inputMode="decimal"
                        defaultValue={(line.grossCents / 100).toFixed(2)}
                        required
                      />
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        name="incurredOn"
                        defaultValue={line.incurredOn}
                        required
                      />
                    </label>
                    <button type="submit" disabled={isPending}>
                      {isPending ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} disabled={isPending}>
                      Annuler
                    </button>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={line.id}>
                <td>{line.label}</td>
                <td>{line.category}</td>
                <td>{formatDateFr(new Date(line.incurredOn))}</td>
                <td>{formatAmountEUR(line.grossCents)}</td>
                <td>{nameOf(line.payerId)}</td>
                <td>{statusLabel(line.deletedAt, line.settlementId)}</td>
                <td>
                  <div>
                    base : {formatAmountEUR(line.baseOwedCents)} ({nameOf(line.otherId)} →{" "}
                    {nameOf(line.payerId)})
                  </div>
                  {line.aidLines.map((aid, i) => (
                    <div key={i}>
                      {aid.label} : {formatAmountEUR(aid.aidCents)} (part{" "}
                      {formatAmountEUR(aid.sharedCents)})
                    </div>
                  ))}
                  <strong>total dû : {formatAmountEUR(line.totalOwedCents)}</strong>
                </td>
                <td>
                  <button type="button" onClick={() => setEditingId(line.id)}>
                    Éditer
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </>
  );
}
