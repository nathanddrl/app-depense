// Rate limiting applicatif sur signIn (audit sécurité E1, 2026-07-13).
// Compteur en mémoire — suffisant pour le volume du projet (2 comptes,
// D17) et complète les limites GoTrue côté Supabase, qui ne sont pas
// vérifiables depuis le code applicatif. Limite connue : sur une plateforme
// serverless (Vercel), chaque instance a son propre compteur ; ce n'est donc
// pas une garantie globale, mais une couche de ralentissement supplémentaire.

interface AttemptRecord {
  failures: number;
  lockedUntil: number;
  lastAttempt: number;
}

const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 60_000;
// Au-delà de cette inactivité, l'historique d'échecs est considéré périmé.
const IDLE_RESET_MS = 5 * 60_000;

const attempts = new Map<string, AttemptRecord>();

function rateLimitKey(ip: string, email: string): string {
  return `${ip}|${email.trim().toLowerCase()}`;
}

function pruneStale(now: number): void {
  for (const [key, record] of attempts) {
    if (record.lockedUntil <= now && now - record.lastAttempt > IDLE_RESET_MS) {
      attempts.delete(key);
    }
  }
}

/** Retourne le nombre de secondes avant déverrouillage, ou `null` si non verrouillé. */
export function isLocked(ip: string, email: string): number | null {
  const record = attempts.get(rateLimitKey(ip, email));
  if (!record) return null;

  const now = Date.now();
  if (record.lockedUntil > now) {
    return Math.ceil((record.lockedUntil - now) / 1000);
  }
  return null;
}

export function registerFailure(ip: string, email: string): void {
  const now = Date.now();
  pruneStale(now);

  const key = rateLimitKey(ip, email);
  const record = attempts.get(key);

  if (!record || now - record.lastAttempt > IDLE_RESET_MS) {
    attempts.set(key, { failures: 1, lockedUntil: 0, lastAttempt: now });
    return;
  }

  const failures = record.failures + 1;
  const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_DURATION_MS : 0;
  attempts.set(key, { failures, lockedUntil, lastAttempt: now });
}

export function registerSuccess(ip: string, email: string): void {
  attempts.delete(rateLimitKey(ip, email));
}
