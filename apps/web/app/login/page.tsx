"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "./actions";
import { Button, Card, Input } from "../_components/design-system/core";
import { Notice } from "../_components/design-system/feedback";
import { Stack, PageTitle } from "../_components/design-system/layout";

const initialState: SignInState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main>
      <Stack gap={4}>
        <PageTitle>étale — connexion</PageTitle>
        <Card>
          <form action={formAction}>
            <Stack gap={2}>
              <Input
                label="email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="mot de passe"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {state.error ? <Notice tone="error">{state.error}</Notice> : null}
              <Button type="submit" disabled={pending}>
                {pending ? "connexion…" : "se connecter"}
              </Button>
            </Stack>
          </form>
        </Card>
      </Stack>
    </main>
  );
}
