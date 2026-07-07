import type { ReactNode } from "react";
import styles from "./Notice.module.css";

type Props = {
  children: ReactNode;
  // Volontairement seulement "neutral" | "error" : aucune variante "success"
  // ne doit exister, même optionnelle (contrainte de surface d'API).
  tone?: "neutral" | "error";
};

export function Notice({ children, tone = "neutral" }: Props) {
  return (
    <p className={`${styles.notice} ${styles[tone]}`} role={tone === "error" ? "alert" : undefined}>
      {children}
    </p>
  );
}
