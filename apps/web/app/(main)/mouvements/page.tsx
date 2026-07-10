import { Stack, PageTitle } from "../../_components/design-system/layout";

// Placeholder CN1 — l'historique complet (groupé par mois, filtres) arrive en CN3.
export default function MouvementsPage() {
  return (
    <main>
      <Stack gap={4}>
        <PageTitle>mouvements</PageTitle>
        <p style={{ color: "var(--text-secondary)" }}>bientôt disponible</p>
      </Stack>
    </main>
  );
}
