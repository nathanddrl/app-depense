import styles from "./AmountDisplay.module.css";

type Props = {
  value: string;
  currency?: string;
  size?: "lg" | "md" | "sm";
  weight?: "regular" | "medium";
  // `balance-negative`/`balance-positive` distincts (jamais un `tone="balance"`
  // générique) : impossible de tomber par erreur sur `-ceiling` ou un autre
  // palier de l'échelle de magnitude, chacun ne pointe que vers son propre
  // `--color-balance-{direction}-text`, calibré pour le contraste de lecture.
  tone?: "primary" | "secondary" | "balance-negative" | "balance-positive";
};

// `.tabular-nums` (utilitaire global, tokens/base.css — T-CD1.1) applique
// --font-feature-amounts : chiffres tabulaires toujours, sur ce composant
// uniquement.
export function AmountDisplay({
  value,
  currency,
  size = "md",
  weight = "regular",
  tone = "primary",
}: Props) {
  return (
    <span
      className={`${styles.amount} ${styles[size]} ${styles[weight]} ${styles[tone]} tabular-nums`}
    >
      {value}
      {currency ? ` ${currency}` : null}
    </span>
  );
}
