"use client";

import type { ChangeEvent } from "react";
import styles from "./Input.module.css";

type Props = {
  label?: string;
  value: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "text" | "number" | "email" | "password";
  suffix?: string;
  /** Champ contrôlé malgré tout (T-CD2.4) : nécessaire pour rester compatible avec
   * une Server Action lisant un FormData natif (ex. useActionState) sans dupliquer
   * la valeur dans un input caché. N'affecte pas le contrat contrôlé de `value`. */
  name?: string;
  autoComplete?: string;
};

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  suffix,
  name,
  autoComplete,
}: Props) {
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
          name={name}
          autoComplete={autoComplete}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </span>
    </label>
  );
}
