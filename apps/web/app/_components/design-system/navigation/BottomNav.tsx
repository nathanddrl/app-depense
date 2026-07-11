"use client";

import type { LucideIcon } from "lucide-react";
import styles from "./BottomNav.module.css";

// BottomNav — barre de navigation basse (navigation-ia §3.1/§3.2). Nouveau
// primitif du kit : aucun équivalent avant (Tabs = segmented control in-place,
// pas une nav de premier niveau). Composant purement présentiel — le câblage
// pathname/router vit côté app (voir (main)/main-bottom-nav.tsx).

export type BottomNavItem = { icon: LucideIcon; label: string; value: string };

type Props = {
  items: BottomNavItem[];
  active: string;
  onNavigate?: (value: string) => void;
};

export function BottomNav({ items, active, onNavigate }: Props) {
  return (
    <nav className={styles.nav} aria-label="navigation principale">
      <ul className={styles.list}>
        {items.map((item) => {
          const Icon = item.icon;
          const activeItem = item.value === active;
          return (
            <li key={item.value} className={styles.item}>
              <button
                type="button"
                className={`${styles.link} ${activeItem ? styles.active : ""}`}
                aria-current={activeItem ? "page" : undefined}
                onClick={() => onNavigate?.(item.value)}
              >
                {/* Indicateur actif = filet horizontal fin au-dessus de l'item
                    (motif de marque WaterLine), jamais une pilule (§3.2). */}
                <span className={styles.indicator} aria-hidden="true" />
                <Icon className={styles.icon} strokeWidth={1.25} aria-hidden="true" />
                <span className={styles.label}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
