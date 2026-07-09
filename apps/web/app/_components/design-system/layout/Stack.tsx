import type { ReactNode } from "react";
import styles from "./Stack.module.css";

type Props = {
  children: ReactNode;
  gap: 1 | 2 | 3 | 4 | 6;
  direction?: "row" | "column";
  wrap?: boolean;
};

export function Stack({ children, gap, direction = "column", wrap = false }: Props) {
  const classNames = [
    styles.stack,
    styles[direction],
    styles[`gap${gap}`],
    wrap ? styles.wrap : null,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classNames}>{children}</div>;
}
