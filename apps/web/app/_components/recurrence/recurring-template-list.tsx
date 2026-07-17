"use client";

// Liste des charges récurrentes actives (spec ch.5.4, T-CR2) : édition du
// montant + désactivation. Même pattern que `aid-section.tsx` (disclosure
// « options », state contrôlé, aucun calcul côté client). Comme
// `settlement-controls.tsx`, aucun état local optimiste sur la liste : après
// chaque action réussie, `onChanged` (fourni par `RecurringMode`, T-CF1)
// rejoue un fetch ciblé (`listRecurringTemplatesAction`) — la ligne disparaît
// d'elle-même une fois le template désactivé (la liste ne remonte que les
// templates `active=true`), jamais via `router.refresh()`.
//
// D13 (déjà garanti côté domaine, `update-recurring-template.ts`) :
// `updateRecurringTemplate` ne touche QUE la ligne `recurring_template` —
// aucune cascade vers l'historique déjà généré. Le message affiché ici se
// contente de FORMULER cette garantie, jamais de la recalculer.
//
// Vocabulaire strict (§8.1) : jamais « template »/« occurrence » à l'écran —
// « charge récurrente » / « échéance ».

import { useState } from "react";
import { updateRecurringTemplateAction, deactivateRecurringTemplateAction } from "../../actions";
import { formatAmountEUR } from "@app/shared";
import type { RecurringTemplate } from "@app/domain-recurrence";
import type { MemberShare } from "../../../lib/household";
import { parseAmountToCents } from "../../../lib/amount";
import { categoryLabelOf } from "../expenses/categories";
import { Button, Card, Input } from "../design-system/core";
import { CategoryChip, AmountDisplay } from "../design-system/balance";
import { Notice, useGlobalTransition } from "../design-system/feedback";
import { Stack } from "../design-system/layout";

type Props = {
  currentMemberId: string;
  defaultShares: MemberShare[];
  templates: RecurringTemplate[];
  /** Fetch ciblé (T-CF1) à rejouer après édition/désactivation d'une charge. */
  onChanged: () => void;
};

// Sémantique propre à cet écran, volontairement distincte de `memberDisplayName`
// (lib/household) : le membre courant devient « toi » et le fallback est « l'autre »
// (jamais "" ni un id brut). On ne la fond donc pas dans le helper partagé.
function nameOf(memberId: string, currentMemberId: string, members: MemberShare[]): string {
  if (memberId === currentMemberId) return "toi";
  return members.find((m) => m.memberId === memberId)?.displayName ?? "l'autre";
}

function shareLabel(
  template: RecurringTemplate,
  currentMemberId: string,
  members: MemberShare[],
): string {
  return template.shares
    .map((s) => `${nameOf(s.memberId, currentMemberId, members)} ${s.pct}%`)
    .join(" · ");
}

export function RecurringTemplateList({
  currentMemberId,
  defaultShares,
  templates,
  onChanged,
}: Props) {
  if (templates.length === 0) {
    return (
      <Card>
        <Notice>aucune charge récurrente pour l&apos;instant</Notice>
      </Card>
    );
  }

  return (
    <Stack gap={2}>
      {templates.map((template) => (
        <TemplateRow
          key={template.id}
          template={template}
          currentMemberId={currentMemberId}
          members={defaultShares}
          onChanged={onChanged}
        />
      ))}
    </Stack>
  );
}

type RowProps = {
  template: RecurringTemplate;
  currentMemberId: string;
  members: MemberShare[];
  onChanged: () => void;
};

function TemplateRow({ template, currentMemberId, members, onChanged }: RowProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() =>
    (template.amountCents / 100).toFixed(2).replace(".", ","),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useGlobalTransition();

  function handleUpdateAmount() {
    setError(null);
    setMessage(null);
    const amountCents = parseAmountToCents(amount);
    if (amountCents === null) {
      setError("montant invalide");
      return;
    }

    startTransition(async () => {
      const result = await updateRecurringTemplateAction({
        templateId: template.id,
        patch: { amountCents },
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMessage(
        `À partir de la prochaine échéance, ce sera ${formatAmountEUR(amountCents)}. Ce qui a déjà été généré ne change pas.`,
      );
      onChanged();
    });
  }

  function handleDeactivate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deactivateRecurringTemplateAction({ templateId: template.id });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onChanged();
    });
  }

  return (
    <Card>
      <Stack gap={2}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <CategoryChip name={categoryLabelOf(template.category)} size={28} />
            <span>{template.label}</span>
          </div>
          <AmountDisplay value={formatAmountEUR(template.amountCents)} size="sm" />
        </div>

        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          le {template.dayOfMonth} de chaque mois · réglé par{" "}
          {nameOf(template.payerId, currentMemberId, members)} ·{" "}
          {shareLabel(template, currentMemberId, members)}
        </span>

        <Button variant="ghost" onClick={() => setOpen((prev) => !prev)}>
          options
        </Button>

        {open ? (
          <Stack gap={2}>
            <Stack direction="row" gap={2} wrap>
              <div style={{ flex: "1 1 160px" }}>
                <Input
                  label="nouveau montant"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  suffix="€"
                />
              </div>
              <Button disabled={isPending} onClick={handleUpdateAmount}>
                confirmer
              </Button>
            </Stack>
            <Button variant="secondary" disabled={isPending} onClick={handleDeactivate}>
              désactiver cette charge récurrente
            </Button>
          </Stack>
        ) : null}

        {error ? <Notice tone="error">{error}</Notice> : null}
        {message ? <Notice tone="neutral">{message}</Notice> : null}
      </Stack>
    </Card>
  );
}
