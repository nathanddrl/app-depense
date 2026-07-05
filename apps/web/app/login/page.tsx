"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main>
      <h1>Étale — Connexion</h1>
      <form action={formAction}>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Mot de passe
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {state.error ? <p role="alert">{state.error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
