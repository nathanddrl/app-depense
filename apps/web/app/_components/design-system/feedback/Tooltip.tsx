import type { ReactNode } from "react";
import styles from "./Tooltip.module.css";

type Props = {
  children: ReactNode;
  label: string;
};

export function Tooltip({ children, label }: Props) {
  return (
    <span className={styles.wrapper}>
      {children}
      <span role="tooltip" className={styles.bubble}>
        {label}
      </span>
    </span>
  );
}
