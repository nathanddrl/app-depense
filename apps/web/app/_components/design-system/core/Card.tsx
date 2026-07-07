import type { ReactNode } from "react";
import styles from "./Card.module.css";

type Props = {
  children: ReactNode;
  raised?: boolean;
  padding?: string;
};

export function Card({ children, raised = false, padding = "var(--space-2)" }: Props) {
  return (
    <div className={raised ? styles.raised : styles.card} style={{ padding }}>
      {children}
    </div>
  );
}
