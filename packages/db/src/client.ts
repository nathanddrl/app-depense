import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Client Supabase typé sur le schéma d'Étale. */
export type DbClient = SupabaseClient<Database>;

/**
 * Fabrique un client Supabase typé. Volontairement FRAMEWORK-AGNOSTIQUE (couche
 * feuille) : l'appelant fournit l'URL et la clé (anon ou service_role selon le
 * contexte). Le wrapping cookies/JWT (SSR Next.js, RLS avec la session utilisateur)
 * se fera côté apps/web en C3 — pas d'import next/* ni react ici.
 */
export function createDbClient(
  url: string,
  key: string,
  options?: SupabaseClientOptions<"public">,
): DbClient {
  return createClient<Database>(url, key, options);
}
