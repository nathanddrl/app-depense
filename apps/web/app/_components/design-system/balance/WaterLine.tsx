import styles from "./WaterLine.module.css";
import { computeWaterLine } from "./water-line-geometry";

type Props = {
  magnitude?: number;
  width?: number;
  height?: number;
};

// 0 = étale (ligne droite, couleur neutre, pas d'accent). Rendu comme une
// ligne horizontale uniquement — jamais un chiffre dans un badge coloré,
// jamais deux teintes opposées pour "ton côté / son côté" (uiuix guide/
// 07-composants.md, 02-couleurs.md).
export function WaterLine({ magnitude = 0, width = 320, height = 64 }: Props) {
  const { path, colorVar } = computeWaterLine(magnitude, width, height);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <path
        className={styles.path}
        d={path}
        fill="none"
        stroke={colorVar}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
