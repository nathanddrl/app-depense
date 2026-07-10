import Link from "next/link";
import { Stack, PageTitle } from "../_components/design-system/layout";
import { Button } from "../_components/design-system/core";

// Repli plein écran (navigation-ia §1.3 / point ouvert §6) : accès direct ou
// refresh sur /ajouter — hors du groupe (main), donc sans BottomNav ni
// dépendance à l'écran précédent. Placeholder CN1 (shell réel = T-CN1.3).
export default function AjouterPage() {
  return (
    <main>
      <Stack gap={4}>
        <PageTitle>ajouter</PageTitle>
        <p style={{ color: "var(--text-secondary)" }}>bientôt disponible</p>
        <Link href="/">
          <Button variant="secondary">retour à l&apos;accueil</Button>
        </Link>
      </Stack>
    </main>
  );
}
