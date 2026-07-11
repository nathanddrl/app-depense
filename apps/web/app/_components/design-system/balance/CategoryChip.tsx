import styles from "./CategoryChip.module.css";
import { getCategoryColorVar, getCategoryInitial } from "./category-color";

type Props = {
  name: string;
  size?: number;
  // T-CN3.2 (filtre catégorie /mouvements) : optionnelles, n'affectent aucun
  // des call sites d'affichage simple existants (DESIGN.md tenu à jour en
  // conséquence). Sans `onClick`, rendu inchangé (`<span role="img">`).
  onClick?: () => void;
  selected?: boolean;
};

export function CategoryChip({ name, size = 32, onClick, selected = false }: Props) {
  const style = {
    width: size,
    height: size,
    background: getCategoryColorVar(name),
    fontSize: Math.round(size * 0.45),
  };
  const initial = <span aria-hidden="true">{getCategoryInitial(name)}</span>;

  if (onClick) {
    return (
      <button
        type="button"
        className={`${styles.chip} ${styles.interactive} ${selected ? styles.selected : ""}`}
        aria-pressed={selected}
        aria-label={name}
        onClick={onClick}
        style={style}
      >
        {initial}
      </button>
    );
  }

  return (
    <span className={styles.chip} role="img" aria-label={name} style={style}>
      {initial}
    </span>
  );
}
