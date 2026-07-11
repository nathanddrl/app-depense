import styles from "./WaterLine.module.css";
import { computeWaterLine } from "./water-line-geometry";

type Props = {
  magnitude?: number;
  width?: number;
  height?: number;
};

// 0 = étale (ligne droite, couleur neutre, pas d'accent). Rendu comme une
// ligne horizontale uniquement — jamais un chiffre dans un badge coloré.
// Encodage directionnel (v2) : une teinte par direction du signe (négatif/
// positif), de poids perceptif comparable — la couleur vient de
// computeWaterLine, jamais recalculée ici.
export function WaterLine({ magnitude = 0, width = 320, height = 64 }: Props) {
  const { path, colorVar } = computeWaterLine(magnitude, width, height);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", maxWidth: width, height: "auto" }}
      role="img"
      aria-hidden="true"
    >
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
