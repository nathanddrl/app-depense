"use server";

// Server Action de connexion (email + mot de passe). Pas d'inscription publique
// ni d'invitation au MVP (D17, bootstrap manuel des 2 comptes). Le client SSR
// écrit les cookies de session ; la RLS s'appliquera ensuite au vrai chemin.

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export type SignInState = { error?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Renseigne ton email et ton mot de passe." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  redirect("/");
}
