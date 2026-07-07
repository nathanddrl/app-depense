import styles from "./CategoryChip.module.css";
import { getCategoryColorVar, getCategoryInitial } from "./category-color";

type Props = {
  name: string;
  size?: number;
};

export function CategoryChip({ name, size = 32 }: Props) {
  return (
    <span
      className={styles.chip}
      role="img"
      aria-label={name}
      style={{
        width: size,
        height: size,
        background: getCategoryColorVar(name),
        fontSize: Math.round(size * 0.45),
      }}
    >
      <span aria-hidden="true">{getCategoryInitial(name)}</span>
    </span>
  );
}
