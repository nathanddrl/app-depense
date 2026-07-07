"use client";

import type { ChangeEvent } from "react";
import styles from "./Input.module.css";

type Props = {
  label?: string;
  value: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "text" | "number";
  suffix?: string;
};

export function Input({ label, value, onChange, placeholder, type = "text", suffix }: Props) {
  return (
    <label className={styles.wrapper}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.field}>
        <input
          className={styles.input}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </span>
    </label>
  );
}
