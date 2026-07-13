// CSP stricte (audit sécurité M1, 2026-07-13). script-src utilise un nonce
// par requête (posé dans proxy.ts) plutôt que 'unsafe-inline' — le seul
// script inline du projet (theme-script.tsx, dangerouslySetInnerHTML) est
// statique, donc un nonce le couvre sans complexité additionnelle.
//
// style-src garde 'unsafe-inline' : l'app utilise largement l'attribut
// `style={{ ... }}` React (valeurs dynamiques, ex. barres de progression)
// dans de nombreux composants du design system. Un nonce ne couvre pas les
// attributs `style` (seulement les éléments <style>/<script>), donc durcir
// ce point demanderait de migrer ces styles dynamiques vers des custom
// properties CSS + classes statiques — hors périmètre de ce correctif.
export function buildCsp(nonce: string, supabaseOrigin: string | null): string {
  const connectSrc = ["'self'", supabaseOrigin].filter(Boolean).join(" ");
  // 'unsafe-eval' uniquement en dev : React Fast Refresh / Turbopack HMR en
  // ont besoin pour reconstruire les callstacks. React ne l'utilise jamais
  // en production (message officiel React), donc absent du build de prod.
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
      : `script-src 'self' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
