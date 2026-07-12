import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentContext, isAdmin } from "../../../lib/auth/context";
import { signOut } from "../../actions";
import { Stack, PageTitle } from "../../_components/design-system/layout";
import { ThemeToggle } from "../../_components/design-system/theme";
import styles from "./reglages.module.css";

// Réglages d'app/profil uniquement (T-CN5, dernière carte du chantier CN) —
// rien qui relève de la gestion de dépenses. Le toggle thème clair/sombre
// (theme-toggle.tsx, T-C9.2) vit ici uniquement, plus dans le layout racine.
export default async function ReglagesPage() {
  const ctx = await getCurrentContext();

  return (
    <main>
      <Stack gap={4}>
        <PageTitle>réglages</PageTitle>
        <div>
          <div className={styles.row}>
            <span>compte</span>
            <span className={styles.value}>{ctx.member.email}</span>
          </div>
          <div className={styles.row}>
            <ThemeToggle />
          </div>
          {isAdmin(ctx) ? (
            <Link href="/admin" className={styles.row}>
              <span>administration</span>
              <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
            </Link>
          ) : null}
          <form action={signOut}>
            <button type="submit" className={styles.rowButton}>
              se déconnecter
            </button>
          </form>
        </div>
      </Stack>
    </main>
  );
}
