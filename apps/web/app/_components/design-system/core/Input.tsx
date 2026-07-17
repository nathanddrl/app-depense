"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./Input.module.css";

type Props = {
  label?: string;
  value: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "text" | "number" | "email" | "password" | "date";
  /** Clavier mobile adapté (ex. `"decimal"` pour un champ montant). */
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  suffix?: string;
  /** Champ contrôlé malgré tout (T-CD2.4) : nécessaire pour rester compatible avec
   * une Server Action lisant un FormData natif (ex. useActionState) sans dupliquer
   * la valeur dans un input caché. N'affecte pas le contrat contrôlé de `value`. */
  name?: string;
  autoComplete?: string;
  required?: boolean;
  /** Champ mot de passe : ajoute un œil pour révéler/masquer la saisie. N'a d'effet
   * qu'avec `type="password"` (masqué par défaut). */
  revealable?: boolean;
};

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  suffix,
  name,
  autoComplete,
  required,
  revealable = false,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const showReveal = revealable && type === "password";
  // On ne touche au type que pour un champ révélable : sinon le contrat d'origine
  // (text/number/email/password/date) reste strictement inchangé.
  const effectiveType = showReveal && revealed ? "text" : type;

  return (
    <label className={styles.wrapper}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.field}>
        <input
          className={styles.input}
          type={effectiveType}
          inputMode={inputMode}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          name={name}
          autoComplete={autoComplete}
          required={required}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
        {showReveal ? (
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "masquer le mot de passe" : "afficher le mot de passe"}
            aria-pressed={revealed}
            // Ne pas voler le focus au champ (garde le curseur dans l'input).
            tabIndex={-1}
          >
            {revealed ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        ) : null}
      </span>
    </label>
  );
}
