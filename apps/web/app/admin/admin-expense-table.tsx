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
import { Button, Card, Input } from "../_components/design-system/core";
import { AmountDisplay } from "../_components/design-system/balance";
import { Notice } from "../_components/design-system/feedback";
import { Stack } from "../_components/design-system/layout";

type Props = {
  initialLines: AdminExpenseOverviewLine[];
  members: MemberShare[];
};

type EditPatch = { label: string; grossCents: number; incurredOn: string };

function statusLabel(deletedAt: string | null, settlementId: string | null): string {
  if (deletedAt) return "supprimée";
  if (settlementId) return "verrouillée";
  return "active";
}

/** État contrôlé requis par `Input` (design-system/core, T-CD2.4) — même raison
 * que expenses-panel.tsx (T-CD2.2) : pas de FormData, `Input` exige `value`. */
function EditRow({
  line,
  isPending,
  onCancel,
  onSubmit,
}: {
  line: AdminExpenseOverviewLine;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (patch: EditPatch) => void;
}) {
  const [label, setLabel] = useState(line.label);
  const [amount, setAmount] = useState((line.grossCents / 100).toFixed(2));
  const [incurredOn, setIncurredOn] = useState(line.incurredOn);

  function handleSubmit() {
    const grossCents = Math.round(Number.parseFloat(amount.replace(",", ".")) * 100);
    onSubmit({ label: label.trim(), grossCents, incurredOn });
  }

  return (
    <tr>
      <td colSpan={8}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Stack gap={1}>
            <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input
              label="Montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              suffix="€"
            />
            <Input
              type="date"
              label="Date"
              value={incurredOn}
              onChange={(e) => setIncurredOn(e.target.value)}
              required
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
              Annuler
            </Button>
          </Stack>
        </form>
      </td>
    </tr>
  );
}

export function AdminExpenseTable({ initialLines: lines, members }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameOf = (memberId: string) =>
    members.find((m) => m.memberId === memberId)?.displayName ?? memberId;

  function handleSubmit(line: AdminExpenseOverviewLine, patch: EditPatch) {
    setError(null);

    startTransition(async () => {
      const result = await adminUpdateExpenseAction({
        expenseId: line.id,
        patch,
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
    <Card>
      <Stack gap={2}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {/* Table large (8 colonnes) contrainte à la largeur de la Card sur mobile
            (T-CD2.4) : scroll horizontal plutôt qu'un débordement hors carte. */}
        <div style={{ overflowX: "auto" }}>
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
                  <EditRow
                    key={line.id}
                    line={line}
                    isPending={isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(patch) => handleSubmit(line, patch)}
                  />
                ) : (
                  <tr key={line.id}>
                    <td>{line.label}</td>
                    <td>{line.category}</td>
                    <td>{formatDateFr(new Date(line.incurredOn))}</td>
                    <td>
                      <AmountDisplay value={formatAmountEUR(line.grossCents)} />
                    </td>
                    <td>{nameOf(line.payerId)}</td>
                    <td>{statusLabel(line.deletedAt, line.settlementId)}</td>
                    <td>
                      <div>
                        base : <AmountDisplay value={formatAmountEUR(line.baseOwedCents)} /> (
                        {nameOf(line.otherId)} → {nameOf(line.payerId)})
                      </div>
                      {line.aidLines.map((aid, i) => (
                        <div key={i}>
                          {aid.label} : <AmountDisplay value={formatAmountEUR(aid.aidCents)} />{" "}
                          (part <AmountDisplay value={formatAmountEUR(aid.sharedCents)} />)
                        </div>
                      ))}
                      <strong>
                        total dû :{" "}
                        <AmountDisplay
                          value={formatAmountEUR(line.totalOwedCents)}
                          weight="medium"
                        />
                      </strong>
                    </td>
                    <td>
                      <Button type="button" onClick={() => setEditingId(line.id)}>
                        Éditer
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </Stack>
    </Card>
  );
}
