"use client";

import styles from "./Tabs.module.css";

type Item = { value: string; label: string };

type Props = {
  items: Item[];
  active: string;
  onChange?: (value: string) => void;
};

export function Tabs({ items, active, onChange }: Props) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === active}
          className={`${styles.tab} ${item.value === active ? styles.active : ""}`}
          onClick={() => onChange?.(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
