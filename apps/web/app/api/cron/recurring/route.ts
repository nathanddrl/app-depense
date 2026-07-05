// Route Handler cron (spec ch.5.4, T-C7.4) — PAS une Server Action : ce chemin
// n'a aucune session/JWT utilisateur (déclenché par Vercel Cron, cf. vercel.json),
// donc pas de `getCurrentContext()`. C'est le SEUL endroit du projet où
// `service_role` est légitime (règle RLS du socle commun : jamais sur le chemin
// utilisateur, réservé cron C7 / admin C8) — le client service_role est construit
// ICI, minimal, et jamais exporté ailleurs.
//
// Sécurité : secret partagé en header `Authorization: Bearer <CRON_SECRET>`
// (convention Vercel Cron — injecté automatiquement si `CRON_SECRET` est défini
// sur le projet Vercel). Absent/incorrect → 401 AVANT toute construction de
// client ou appel de génération.

import { createDbClient, SupabaseRecurringTemplateRepository } from "@app/db";
import { runRecurringGeneration } from "@app/domain-recurrence";
import type { RecurringTemplateRepository } from "@app/domain-recurrence";

export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // mal configuré → refuse par défaut, jamais un fallback ouvert.
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Client service_role minimal, isolé à ce fichier (jamais exporté ailleurs). */
function createServiceRoleRepository(): RecurringTemplateRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createDbClient(url, serviceRoleKey);
  return new SupabaseRecurringTemplateRepository(supabase);
}

export type CronGenerationSummary = { generated: number; skipped: number; failed: number };

/**
 * Exécute la génération et projette le résultat sur la forme JSON de la route.
 * `repo` est injectable (tests) ; en production, construit le repo service_role réel.
 */
export async function runCronGeneration(
  repo: RecurringTemplateRepository = createServiceRoleRepository(),
  now?: Date,
): Promise<CronGenerationSummary> {
  const result = await runRecurringGeneration(repo, now);
  // `runRecurringGeneration` ne renvoie jamais `err()` aujourd'hui (chaque template
  // en échec est capturé dans `results`) ; défense en profondeur si ça change un jour.
  if (!result.ok) return { generated: 0, skipped: 0, failed: 0 };

  const summary: CronGenerationSummary = { generated: 0, skipped: 0, failed: 0 };
  for (const outcome of result.data.results) {
    if (outcome.status === "generated") summary.generated += 1;
    else if (outcome.status === "skipped") summary.skipped += 1;
    else summary.failed += 1;
  }
  return summary;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }
  const summary = await runCronGeneration();
  return Response.json(summary, { status: 200 });
}
