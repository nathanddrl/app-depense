import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentContext, isAdmin } from "../../../lib/auth/context";

// Deuxième haie d'accès (la première est l'auth, gérée par `getCurrentContext`) :
// redirige les non-admin avant tout rendu enfant — pas de flash de contenu admin.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getCurrentContext();
  if (!isAdmin(ctx)) redirect("/");
  return <>{children}</>;
}
