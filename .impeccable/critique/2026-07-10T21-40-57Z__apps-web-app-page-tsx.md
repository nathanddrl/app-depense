---
target: apps/web home + core surfaces
total_score: 27/40
p0_count: 2
p1_count: 2
timestamp: 2026-07-10T21-40-57Z
slug: apps-web-app-page-tsx
---
# Critique — Étale (apps/web, home + core surfaces)

Method: dual-agent (A: design review · B: detector) · target apps-web-app-page-tsx

## Sur quoi se base cette analyse

Deux évaluations indépendantes, menées en isolation pour ne pas s'influencer. **A — revue design** : lecture du code source (JSX, CSS modules, tokens, copy) confrontée à PRODUCT.md et DESIGN.md, qui font foi ; on juge la tenue de la marque, l'ergonomie et la charge cognitive, pas seulement l'esthétique. **B — détecteur déterministe** (`detect.mjs`) : un scan par règles cherchant les tells d'UI générée (dégradés de texte, bordures-accent, faux contrastes, etc.) — ici 0 résultat, vérifié réel (un fichier-test volontairement « slop » déclenche bien le détecteur). Aucun rendu navigateur n'a pu être inspecté : la surface principale est derrière l'auth Supabase et aucun serveur de dev ne tournait, donc l'analyse est statique (source + tokens).

Le **score de santé** applique les 10 heuristiques de Nielsen, chacune notée de 0 à 4 (0 = absent, 4 = réellement excellent), pour un total sur 40 ; la plupart des interfaces réelles se situent entre 20 et 32. Chaque problème est ensuite priorisé **P0→P3** : P0 = bloquant ou atteinte directe à l'identité de marque, P1 = gêne majeure à corriger avant livraison, P2/P3 = finition. Les personas (accessibilité, mobile distrait, partenaire anxieux face à l'argent) servent à faire apparaître ce qu'une seule perspective raterait. Le chiffrage reste un jugement humain assisté, pas une mesure exacte — il sert à hiérarchiser, pas à certifier.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good offline gate + "calcul en cours…", but no aria-live — optimistic adds & balance flips silent to SR |
| 2 | Match System / Real World | 3 | Excellent proprietary vocab, but "remboursé" (banned word) leaks at settlement |
| 3 | User Control & Freedom | 2 | Creditor's "j'ai reçu" irreversible, one tap, no confirm; members can't delete an expense |
| 4 | Consistency & Standards | 3 | Strong tokens, but Button alone has no focus style; balance copy capitalizes against bas-de-casse rule |
| 5 | Error Prevention | 2 | Money fields type="text", no inputMode; centsFrom → NaN silently; irreversible confirm unguarded |
| 6 | Recognition vs Recall | 3 | Labels visible, good "pourquoi ?" disclosures; two stacked filter rows add mild load |
| 7 | Flexibility & Efficiency | 2 | No keyboard shortcuts; Tabs lack roving-tabindex arrow nav |
| 8 | Aesthetic & Minimalist | 4 | Reference-grade restraint — nothing decorative |
| 9 | Error Recovery | 2 | Errors surface raw res.error.message with no recovery guidance |
| 10 | Help & Documentation | 3 | The "pourquoi ?" calculation breakdown is genuine inline help |
| Total | | 27/40 | Good — correctable gaps, not broken |

## Anti-Patterns Verdict — does this look AI-generated? No.

LLM assessment: The opposite of slop. Austerity is authored and enforced structurally: --elevation-shadow: none is a token every surface (incl. Dialog) resolves against; Notice.tsx refuses a success tone at the type level; WaterLine derives curve depth and clay intensity from a single abs() so it can't drift. Subtly-off moments are copy and interaction, never components.

Deterministic scan: detect.mjs returned 0 findings across page.tsx, all _components, login, recurrence, admin, styles — exit 0. Verified clean, not skipped: a synthetic slop file (bg-clip-text + gradient + animate-bounce + Inter) fired 3 findings + exit 2 through the same detector. No config/ignore suppression. No false positives. Detector has no no-border-radius or too-monochrome rule, so austere choices carry zero deterministic risk.

Where A and B agree: visual system is clean and coherent. Where detector is blind: every real issue is semantic (forbidden word, missing focus ring, irreversible tap) — none regex-detectable.

Visual overlays: none — no rendered surface reachable (no dev server, surface behind Supabase auth).

## Overall Impression

A genuinely well-made, strongly-authored product surface — restraint that's hard to hold and is held via tokens and type-level guards. Scores 27 because two things slip at the emotional peak: the app named étale never says "étale," and the calm witness says "remboursé" at the tensest moment. Biggest opportunity is nearly free: fix the settlement + zero-balance copy to reclaim the brand thesis where it matters most.

## What's Working

1. Constraint-as-token discipline — elevation.css:6 makes zero-shadow un-violatable, incl. modals.
2. A signature component that can't lie to itself — water-line-geometry.ts:22-36 guarantees curve and color agree, unit-tested.
3. Progressive disclosure matching the ethos — "pourquoi ?" breakdown and aid-section's "on ne partage que ce qui reste : X au lieu de Y".

## Priority Issues

[P0] "remboursé" at the settlement moment — settlement-controls.tsx:51,59. "remboursement" explicitly banned in PRODUCT.md and DESIGN.md; line 4's own comment claims "Vocabulaire strict." Emotional peak; makes "vocabulaire propre" claim feel unreliable. Fix: movement register — "tu as marqué l'écart comme résorbé auprès de X — en attente de sa confirmation." Keep "j'ai reçu" button. → /impeccable clarify

[P0] "Vous êtes à jour" instead of "vous êtes étale" — balance-panel.tsx:61. DESIGN.md gives "vous êtes étale" as canonical; copy also capitalizes against bas-de-casse rule. Loses the most brand-defining line + imports fintech vocab at resorption payoff (peak-end). Fix: "vous êtes étale" at zero; lowercase all three BalanceStatement strings (61, 75-76). → /impeccable typeset

[P1] Button has no visible focus indicator — Button.module.css ships hover but no :focus-visible, while Checkbox/Radio/Switch/Input carry the clay ring DESIGN.md §5 promises. Keyboard/switch users lose focus on every critical action incl. irreversible "j'ai reçu". WCAG 2.4.7. Fix: add &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }. → /impeccable harden

[P1] Money inputs unsafe on mobile-first PWA — amount fields default type="text", no inputMode (expense-form.tsx:129, aid-section.tsx:258); centsFrom returns NaN on bad input, no field validation. No numeric keypad for one-handed capture. Fix: add inputMode="decimal" to Input, guard centsFrom against NaN, surface field error. → /impeccable harden

[P2] WaterLine saturates below amounts that cause tension — water-line-magnitude.ts:9 caps at 150 € (WATER_LINE_REFERENCE_CENTS = 15_000). Any écart ≥150 € renders identical maxed curve. Signature magnitude encoding degrades to on/off across the rent/deposit range. Fix: scale reference to household history (rolling median or current rent). → /impeccable optimize

## Persona Red Flags

Sam (a11y/keyboard/SR) — most exposed: no focus ring on any Button; no aria-live/role=status anywhere; no prefers-reduced-motion guard despite 600ms WaterLine + 1200ms settle-extended (WCAG 2.3.3); WaterLine aria-hidden so magnitude is SR-invisible.

Casey (distracted, mobile, one-handed) — no numeric keyboard on money fields; fixed theme toggle overlaps header link on ~375px phone; create form 6–7 fields flat with no stepping.

"The quietly money-anxious partner" (project persona) — "remboursé" reframes a shared-life adjustment as a debt repaid; irreversible one-tap "j'ai reçu" with no confirm/reopen is a trust hazard between two people; zero-state never delivers the reassuring "étale" exhale.

## Minor Observations

- Errors render res.error.message verbatim (settlement-controls.tsx:87, expenses-panel.tsx:64).
- Tabs use role="tab" but are filters, and lack roving-tabindex arrow nav.
- Category selector 6 options, category filter 7 — above ≤4 guideline (cognitive-load: 3 of 8 checks failing).
- Dialog traps Escape/scrim-click but does not trap/restore focus on close.
- Justified magic values (20px, 28px, 160px in expense-form.tsx) outside --space-* scale.

## Questions to Consider

1. Why does the app named "étale" never say "étale"?
2. Should "j'ai reçu" be irreversible on a single tap between two partners?
3. Does the WaterLine encode magnitude, or just presence — if it saturates below every amount that causes tension?
