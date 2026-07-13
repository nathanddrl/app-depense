"use server";

// Server Action de connexion (email + mot de passe). Pas d'inscription publique
// ni d'invitation au MVP (D17, bootstrap manuel des 2 comptes). Le client SSR
// écrit les cookies de session ; la RLS s'appliquera ensuite au vrai chemin.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { isLocked, registerFailure, registerSuccess } from "../../lib/auth/login-rate-limit";

export type SignInState = { error?: string };

async function clientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Renseigne ton email et ton mot de passe." };
  }

  const ip = await clientIp();
  const retryAfterSeconds = isLocked(ip, email);
  if (retryAfterSeconds !== null) {
    return {
      error: `Trop de tentatives échouées. Réessaie dans ${retryAfterSeconds}s.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    registerFailure(ip, email);
    return { error: "Email ou mot de passe incorrect." };
  }

  registerSuccess(ip, email);
  redirect("/");
}
