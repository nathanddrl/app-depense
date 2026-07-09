"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "./actions";
import { Button, Card, Input } from "../_components/design-system/core";
import { Notice } from "../_components/design-system/feedback";

const initialState: SignInState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main>
      <h1>Étale — Connexion</h1>
      <Card>
        <form action={formAction}>
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Mot de passe"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {state.error ? <Notice tone="error">{state.error}</Notice> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
