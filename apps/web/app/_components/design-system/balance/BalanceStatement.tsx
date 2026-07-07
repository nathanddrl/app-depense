import type { ReactNode } from "react";
import styles from "./BalanceStatement.module.css";

type Props = {
  children: ReactNode;
  size?: "lg" | "md" | "sm";
};

// Réservé aux phrases complètes de constat déclaratif à la 1re/3e personne —
// jamais un titre de section ni un label d'écran/UI chrome (mésusage).
export function BalanceStatement({ children, size = "md" }: Props) {
  return <p className={`${styles.statement} ${styles[size]}`}>{children}</p>;
}
