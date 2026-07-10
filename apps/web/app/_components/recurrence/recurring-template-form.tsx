"use client";

// Formulaire de création d'une charge récurrente (spec ch.5.4, T-CR1). Même
// pattern que `expense-form.tsx` : Card/Input/Button du kit, state contrôlé.
// La catégorie utilise cette fois un `<select>` natif (classes partagées
// `native-select.module.css`, T-CD2.2) + un `CategoryChip` en aperçu — pas la
// grille de boutons d'`expense-form.tsx`, ce formulaire reste volontairement
// plus dense.
//
// Décision produit du 09/07 (`decisions-techniques.md`, T-CR4) : le champ
// Aide n'apparaît que pour la catégorie loyer, avec un sélecteur bénéficiaire
// étendu « toi / [nom] / les 2 » — « les 2 » construit directement un tableau
// `aids` à 2 lignes (`aid-split.ts`, même règle floor/reliquat que
// `aid-section.tsx`) au lieu d'appeler l'action deux fois : ici la création
// du template et de ses aides passe déjà par UN SEUL appel à
// `createRecurringTemplateAction` (`aids[]`), pas de composition à faire.
// Comme dans `expenses-panel.tsx`, aucun calcul de parts/plafond n'est fait
// ici — `createRecurringTemplate` (domain-recurrence) reste seul habilité,
// calc-engine seul en aval à la génération d'occurrence.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRecurringTemplateAction } from "../../actions";
import type { MemberShare } from "../../../lib/household";
import { CATEGORIES } from "../expenses/categories";
import { BOTH_BENEFICIARIES, splitBothCents } from "../expenses/aid-split";
import { Button, Card, Input, Checkbox } from "../design-system/core";
import { CategoryChip } from "../design-system/balance";
import { Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import nativeSelectStyles from "../design-system/core/native-select.module.css";

type Category = (typeof CATEGORIES)[number]["value"];

type Props = {
  currentMemberId: string;
  defaultShares: MemberShare[];
};

function centsFrom(raw: string): number {
  return Math.round(Number.parseFloat(raw.replace(",", ".")) * 100);
}

type NewAidInput = { beneficiaryId: string; label: string; amountCents: number };

/** « les 2 » (T-CR4) construit directement les 2 lignes `aids[]` — un seul
 * appel à `createRecurringTemplateAction` fait déjà tout, pas de composition
 * séquentielle nécessaire ici (contrairement à `aid-section.tsx`, qui ajoute
 * une aide sur une dépense déjà existante). */
function buildAids(
  category: Category,
  aideOn: boolean,
  aideAmount: string,
  aideBeneficiary: string,
  currentMemberId: string,
  otherMemberId: string | undefined,
): NewAidInput[] | undefined {
  if (category !== "loyer" || !aideOn || !aideAmount) return undefined;
  const amountCents = centsFrom(aideAmount);

  if (aideBeneficiary === BOTH_BENEFICIARIES && otherMemberId) {
    const [firstCents, secondCents] = splitBothCents(amountCents);
    return [
      { beneficiaryId: currentMemberId, label: "aide", amountCents: firstCents },
      { beneficiaryId: otherMemberId, label: "aide", amountCents: secondCents },
    ];
  }
  return [{ beneficiaryId: aideBeneficiary, label: "aide", amountCents }];
}

export function RecurringTemplateForm({ currentMemberId, defaultShares }: Props) {
  const router = useRouter();
  const otherMember = defaultShares.find((m) => m.memberId !== currentMemberId);
  const initialSharePct =
    defaultShares.find((m) => m.memberId === currentMemberId)?.defaultSharePct ?? 50;

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<Category>("loyer");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState(currentMemberId);
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [sharePct, setSharePct] = useState(initialSharePct);
  const [aideOn, setAideOn] = useState(false);
  const [aideAmount, setAideAmount] = useState("");
  const [aideBeneficiary, setAideBeneficiary] = useState<string>(currentMemberId);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function resetForm() {
    setLabel("");
    setCategory("loyer");
    setAmount("");
    setPayerId(currentMemberId);
    setDayOfMonth("");
    setSharePct(initialSharePct);
    setAideOn(false);
    setAideAmount("");
    setAideBeneficiary(currentMemberId);
  }

  function handleSubmit() {
    setError(null);
    setMessage(null);
    const trimmedLabel = label.trim();
    if (!trimmedLabel || !amount || !dayOfMonth) return;

    const shares = defaultShares.map((m) => ({
      memberId: m.memberId,
      pct: m.memberId === currentMemberId ? sharePct : 100 - sharePct,
    }));

    startTransition(async () => {
      const result = await createRecurringTemplateAction({
        label: trimmedLabel,
        category,
        amountCents: centsFrom(amount),
        payerId,
        dayOfMonth: Number.parseInt(dayOfMonth, 10),
        shares,
        aids: buildAids(
          category,
          aideOn,
          aideAmount,
          aideBeneficiary,
          currentMemberId,
          otherMember?.memberId,
        ),
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setMessage(
        `Charge récurrente créée : ${result.data.label}, le ${result.data.dayOfMonth} de chaque mois.`,
      );
      resetForm();
      router.refresh();
    });
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
          nouvelle charge récurrente
        </span>

        <Input label="libellé" value={label} onChange={(e) => setLabel(e.target.value)} />

        <Stack direction="row" gap={2} wrap>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)" }}>
            <label className={nativeSelectStyles.wrapper}>
              <span className={nativeSelectStyles.label}>catégorie</span>
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
            <CategoryChip name={CATEGORIES.find((c) => c.value === category)?.label ?? category} />
          </div>
        </Stack>

        <Stack direction="row" gap={2} wrap>
          <div style={{ flex: "1 1 160px" }}>
            <Input
              label="montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              suffix="€"
            />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <Input
              type="number"
              label="jour du mois"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="1-31"
            />
          </div>
        </Stack>

        <label className={nativeSelectStyles.wrapper}>
          <span className={nativeSelectStyles.label}>qui paie</span>
          <select
            className={nativeSelectStyles.select}
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
          >
            <option value={currentMemberId}>toi</option>
            {defaultShares
              .filter((m) => m.memberId !== currentMemberId)
              .map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.displayName}
                </option>
              ))}
          </select>
        </label>

        {otherMember ? (
          <Stack gap={1}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              partage
            </span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <input
                type="range"
                min={0}
                max={100}
                value={sharePct}
                onChange={(e) => setSharePct(Number(e.target.value))}
                style={{ flex: "1 1 auto", minWidth: 0, accentColor: "var(--text-primary)" }}
              />
              <span
                className="tabular-nums"
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                  marginLeft: "auto",
                }}
              >
                toi {sharePct}% · {otherMember.displayName} {100 - sharePct}%
              </span>
            </div>
          </Stack>
        ) : null}

        {category === "loyer" ? (
          <Stack gap={1}>
            <Checkbox
              checked={aideOn}
              onChange={setAideOn}
              label="une aide récurrente est rattachée (ex. APL)"
            />
            {aideOn ? (
              <Stack gap={2}>
                <Input
                  label="montant de l'aide"
                  value={aideAmount}
                  onChange={(e) => setAideAmount(e.target.value)}
                  suffix="€"
                />
                <label className={nativeSelectStyles.wrapper}>
                  <span className={nativeSelectStyles.label}>qui la touche ?</span>
                  <select
                    className={nativeSelectStyles.select}
                    value={aideBeneficiary}
                    onChange={(e) => setAideBeneficiary(e.target.value)}
                  >
                    <option value={currentMemberId}>toi</option>
                    {otherMember ? (
                      <>
                        <option value={otherMember.memberId}>{otherMember.displayName}</option>
                        <option value={BOTH_BENEFICIARIES}>les 2</option>
                      </>
                    ) : null}
                  </select>
                </label>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {error ? <Notice tone="error">{error}</Notice> : null}
        {message ? <Notice tone="neutral">{message}</Notice> : null}
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "création…" : "créer"}
        </Button>
      </Stack>
    </Card>
  );
}
