import { computeWaterLine } from "../balance/water-line-geometry";
import styles from "./WaterSeparator.module.css";

type Props = {
  label?: string;
};

// Coordonnées internes arbitraires : à magnitude=0 la courbe dégénère en
// ligne droite (depth=0), donc le viewBox s'étire sans distorsion visible
// quelle que soit la largeur réelle du conteneur (preserveAspectRatio="none").
const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 8;

export function WaterSeparator({ label }: Props) {
  const { path, colorVar } = computeWaterLine(0, VIEWBOX_WIDTH, VIEWBOX_HEIGHT);

  return (
    <div className={styles.separator}>
      <svg
        className={styles.line}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={path} fill="none" stroke={colorVar} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      {label ? <span className={styles.label}>{label}</span> : null}
    </div>
  );
}
