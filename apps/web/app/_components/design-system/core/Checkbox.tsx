"use client";

import styles from "./Checkbox.module.css";

type Props = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
};

export function Checkbox({ checked, onChange, label }: Props) {
  return (
    <label className={styles.wrapper}>
      <input
        className={styles.input}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
}
