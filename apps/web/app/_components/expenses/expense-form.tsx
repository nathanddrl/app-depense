"use client";

// Formulaire de création (spec ch.5.1, 8.4) — recomposé depuis la maquette
// (uiuix-guide/mainpage.zip, ExpenseForm.jsx) avec les vrais composants
// design-system et les vraies catégories du domaine.
//
// Le payeur est sélectionnable (« qui a payé », même sélecteur natif que
// `recurring-template-form.tsx`/`aid-section.tsx`) — décision revenue sur le
// choix initial (implicite = utilisateur connecté), un membre pouvant saisir
// une dépense payée par l'autre. La répartition se pilote via un curseur
// unique (foyer à 2 personnes, `defaultShares` toujours de longueur 2),
// indépendant du payeur : payer et partager sont deux questions distinctes
// (même contrat que `CreateExpenseInput`, `payerId` et `shares` séparés).
// L'aide cochée ici ne fait AUCUN calcul côté client : seul un montant brut est
// collecté, `addAidAction` (côté parent) applique la vraie logique calc-engine.
//
// Harmonisé avec `aid-section.tsx` (T-CR4, decisions-techniques.md) : champ
// Aide visible uniquement pour la catégorie loyer, même sélecteur « toi /
// [nom] / les 2 » (`aid-split.ts`). Le split réel (2 appels `addAid`) est
// fait par le parent (`expenses-panel.tsx`), qui a seul accès à l'`expenseId`
// une fois la dépense créée — ce composant se contente de faire remonter le
// bénéficiaire choisi (memberId ou la sentinelle `BOTH_BENEFICIARIES`).

import { useState } from "react";
import type { Category } from "@app/domain-expense";
import type { MemberShare } from "../../../lib/household";
import { parseAmountToCents } from "../../../lib/amount";
import { CATEGORIES } from "./categories";
import { BOTH_BENEFICIARIES } from "./aid-split";
import { Button, Card, Input, Checkbox } from "../design-system/core";
import { CategoryChip } from "../design-system/balance";
import { Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import nativeSelectStyles from "../design-system/core/native-select.module.css";

export type NewExpenseInput = {
  label: string;
  category: Category;
  grossCents: number;
  payerId: string;
  incurredOn: string;
  shares: { memberId: string; pct: number }[];
  aid: { amountCents: number; beneficiaryId: string } | null;
};

type Props = {
  currentMemberId: string;
  defaultShares: MemberShare[];
  pending: boolean;
  error: string | null;
  onSubmit: (input: NewExpenseInput) => Promise<boolean>;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({ currentMemberId, defaultShares, pending, error, onSubmit }: Props) {
  const otherMember = defaultShares.find((m) => m.memberId !== currentMemberId);
  const initialPayerPct =
    defaultShares.find((m) => m.memberId === currentMemberId)?.defaultSharePct ?? 50;

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("autre");
  const [payerId, setPayerId] = useState(currentMemberId);
  const [incurredOn, setIncurredOn] = useState(today());
  const [payerPct, setPayerPct] = useState(initialPayerPct);
  const [aideOn, setAideOn] = useState(false);
  const [aideAmount, setAideAmount] = useState("");
  const [aideBeneficiary, setAideBeneficiary] = useState<string>(currentMemberId);
  const [amountError, setAmountError] = useState<string | null>(null);

  async function handleSubmit() {
    setAmountError(null);
    const trimmedLabel = label.trim();
    if (!trimmedLabel || !amount) return;

    const grossCents = parseAmountToCents(amount);
    if (grossCents === null) {
      setAmountError("montant invalide");
      return;
    }

    let aid: NewExpenseInput["aid"] = null;
    if (category === "loyer" && aideOn && aideAmount) {
      const aideCents = parseAmountToCents(aideAmount);
      if (aideCents === null) {
        setAmountError("montant de l'aide invalide");
        return;
      }
      aid = { amountCents: aideCents, beneficiaryId: aideBeneficiary };
    }

    const shares = defaultShares.map((m) => ({
      memberId: m.memberId,
      pct: m.memberId === currentMemberId ? payerPct : 100 - payerPct,
    }));

    const success = await onSubmit({
      label: trimmedLabel,
      category,
      grossCents,
      payerId,
      incurredOn,
      shares,
      aid,
    });

    if (success) {
      setLabel("");
      setAmount("");
      setCategory("autre");
      setPayerId(currentMemberId);
      setIncurredOn(today());
      setAideOn(false);
      setAideAmount("");
      setAideBeneficiary(currentMemberId);
    }
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
          nouvelle dépense
        </span>

        <Input label="libellé" value={label} onChange={(e) => setLabel(e.target.value)} />

        <Stack direction="row" gap={2} wrap>
          {/* 160px : largeur mini de flex-basis, pas un espacement — hors périmètre
              de l'échelle --space-* (même exception que maxWidth 960px sur admin/page.tsx) */}
          <div style={{ flex: "1 1 160px" }}>
            <Input
              label="montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              suffix="€"
            />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <Input
              type="date"
              label="date"
              value={incurredOn}
              onChange={(e) => setIncurredOn(e.target.value)}
              required
            />
          </div>
        </Stack>

        <Stack gap={1}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            catégorie
          </span>
          {/* 20px : entre --space-2 (16px) et --space-3 (32px), écart notable
              (20-25%) des deux côtés — conservé en dur (audit T-CD3) */}
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={category === c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  // 6px : écart notable avec --space-1 (8px, +33%) — conservé en dur (audit T-CD3)
                  gap: "6px",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  opacity: category === c.value ? 1 : 0.45,
                  transition: "opacity var(--motion-micro-duration) var(--motion-micro-easing)",
                }}
              >
                <CategoryChip name={c.label} size={32} />
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: category === c.value ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {c.label.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        </Stack>

        <label className={nativeSelectStyles.wrapper}>
          <span className={nativeSelectStyles.label}>qui a payé</span>
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
              répartition
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
                value={payerPct}
                onChange={(e) => setPayerPct(Number(e.target.value))}
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
                toi {payerPct}% · {otherMember.displayName} {100 - payerPct}%
              </span>
            </div>
          </Stack>
        ) : null}

        {category === "loyer" ? (
          <Stack gap={1}>
            <Checkbox
              checked={aideOn}
              onChange={setAideOn}
              label="une aide est rattachée à cette dépense"
            />
            {aideOn ? (
              // 28px : proche de --space-3 (32px, écart 14%) mais pas assez pour
              // substituer sans changement visuel constaté — conservé en dur (audit T-CD3)
              <div style={{ paddingLeft: "28px" }}>
                <Stack gap={2}>
                  <Input
                    label="montant de l'aide"
                    value={aideAmount}
                    onChange={(e) => setAideAmount(e.target.value)}
                    inputMode="decimal"
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
              </div>
            ) : null}
          </Stack>
        ) : null}

        {amountError ? <Notice tone="error">{amountError}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "ajout…" : "ajouter"}
        </Button>
      </Stack>
    </Card>
  );
}
