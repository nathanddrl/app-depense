// Relevé de l'écart (écran « d'où vient l'écart », niveau 1, sous le donut).
// Le donut montre qui a payé quoi en BRUT ; le solde du centre tient compte
// des parts, des aides, des versements et des corrections — sans pont entre
// les deux, l'écran se contredisait (« tu as payé trois fois plus » mais « tu
// dois »). Ce relevé part de zéro (début de la période) et arrive au solde,
// ligne par ligne. Il AFFICHE seulement : chaque montant sort de
// `calc-engine.computeBalanceStatement` (DA4), le total est garanti égal au
// solde côté serveur (`getBalanceBreakdownAction`).
//
// Montants neutres, jamais vert/rouge (DESIGN.md : aucun « camp ») ; le sens
// se lit dans le signe et dans la phrase. Vocabulaire PRODUCT.md : « versé »,
// jamais « remboursement »/« dette ».

import { formatAmountEUR, formatDateShortFr, toDateParis } from "@app/shared";
import type { ReactNode } from "react";
import type { Balance, BalanceStatementView, SettlementCorrectionLine } from "@app/domain-expense";
import { formatBalanceMessage, memberDisplayName, type MemberShare } from "../../../lib/household";
import { correctionAction } from "./settlement-corrections-copy";
import styles from "./balance-statement.module.css";

/** Montant signé lisible : « +297,00 € », « −60,37 € », « 0,00 € ». */
function signed(cents: number): string {
  if (cents === 0) return formatAmountEUR(0);
  return `${cents > 0 ? "+" : "−"}${formatAmountEUR(Math.abs(cents))}`;
}

function Line({ title, cents, children }: { title: string; cents: number; children?: ReactNode }) {
  return (
    <li className={styles.line}>
      <div className={styles.lineHead}>
        <span className={styles.lineTitle}>{title}</span>
        <span className={styles.amount}>{signed(cents)}</span>
      </div>
      {children}
    </li>
  );
}

type Props = {
  statement: BalanceStatementView;
  balance: Balance;
  corrections: SettlementCorrectionLine[];
  periodStart: string | null;
  members: MemberShare[];
  currentMemberId: string;
};

export function BalanceStatementLines({
  statement,
  balance,
  corrections,
  periodStart,
  members,
  currentMemberId,
}: Props) {
  const { lines, sharePct, aids, settlements } = statement;
  const name = (id: string) => (id === currentMemberId ? "toi" : memberDisplayName(members, id));
  const others = members.filter((m) => m.memberId !== currentMemberId);
  const otherName = others.length === 1 ? others[0].displayName : "l'autre";

  const aidParts = [
    lines.aidReceivedCents > 0 ? `tu as touché ${formatAmountEUR(lines.aidReceivedCents)}` : null,
    lines.aidOtherCents > 0
      ? `${otherName} a touché ${formatAmountEUR(lines.aidOtherCents)}`
      : null,
  ].filter(Boolean);

  return (
    <section className={styles.statement} aria-labelledby="statement-title">
      <h3 id="statement-title" className={styles.title}>
        comment on arrive à ce montant
      </h3>
      <ol className={styles.lines}>
        {lines.paidCents !== 0 || lines.grossShareCents !== 0 ? (
          <Line title="les dépenses" cents={lines.expensesCents}>
            <p className={styles.detail}>
              tu as payé {formatAmountEUR(lines.paidCents)}, ta part était{" "}
              {formatAmountEUR(lines.grossShareCents)}
              {sharePct !== null ? ` (${sharePct.toLocaleString("fr-FR")} %)` : ""}
            </p>
          </Line>
        ) : null}

        {aidParts.length > 0 || lines.aidsCents !== 0 ? (
          <Line title="les aides" cents={lines.aidsCents}>
            {aidParts.length > 0 ? (
              <p className={styles.detail}>
                {aidParts.join(", ")} ; une aide réduit la dépense, que vous partagez ensuite
              </p>
            ) : null}
            {aids.length > 0 ? (
              <details className={styles.disclosure}>
                <summary>voir {aids.length > 1 ? `les ${aids.length} aides` : "l'aide"}</summary>
                <ul className={styles.items}>
                  {aids.map((aid) => (
                    <li key={aid.id} className={styles.item}>
                      <span>
                        {aid.label}, sur {aid.expenseLabel} du {formatDateShortFr(aid.incurredOn)}
                      </span>
                      <span className={styles.itemMeta}>
                        {formatAmountEUR(aid.amountCents)} touchés par {name(aid.beneficiaryId)}
                        {aid.declaredCents !== undefined
                          ? ` (aide de ${formatAmountEUR(aid.declaredCents)}, plafonnée au montant de la dépense)`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Line>
        ) : null}

        {lines.settlementsCents !== 0 ? (
          <Line title="les versements" cents={lines.settlementsCents}>
            <ul className={styles.items}>
              {settlements.map((s, i) => (
                <li key={s.id ?? `${s.confirmedAt}-${i}`} className={styles.detail}>
                  {s.fromMemberId === currentMemberId
                    ? `tu as versé ${formatAmountEUR(s.amountCents)} à ${name(s.toMemberId)}`
                    : `${name(s.fromMemberId)} t'a versé ${formatAmountEUR(s.amountCents)}`}{" "}
                  le {formatDateShortFr(toDateParis(s.confirmedAt))}
                </li>
              ))}
            </ul>
          </Line>
        ) : null}

        {lines.correctionsCents !== 0 && periodStart ? (
          <Line
            title={`changé après le règlement du ${formatDateShortFr(periodStart)}`}
            cents={lines.correctionsCents}
          >
            <p className={styles.detail}>sur des dépenses d&apos;avant ce règlement</p>
            <details className={styles.disclosure}>
              <summary>
                voir{" "}
                {corrections.length > 1 ? `les ${corrections.length} changements` : "le changement"}
              </summary>
              <ul className={styles.items}>
                {corrections.map((c) => (
                  <li key={`${c.expenseId}-${c.kind}`} className={styles.item}>
                    <span>
                      {c.label}, {formatDateShortFr(c.incurredOn)}
                    </span>
                    <span className={styles.itemMeta}>{correctionAction(c)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Line>
        ) : null}
      </ol>

      <div className={styles.total}>
        <span>= {formatBalanceMessage(balance, members, currentMemberId)}</span>
      </div>
    </section>
  );
}
