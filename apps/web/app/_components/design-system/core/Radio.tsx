"use client";

import styles from "./Radio.module.css";

type Props = {
  checked: boolean;
  onChange?: () => void;
  label?: string;
};

export function Radio({ checked, onChange, label }: Props) {
  return (
    <label className={styles.wrapper}>
      <input className={styles.input} type="radio" checked={checked} onChange={onChange} />
      {label ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
}
