import { getCurrentContext } from "../../../../lib/auth/context";
import { getDefaultShares } from "../../../../lib/household";
import { AddScreen } from "../../../_components/add/add-screen";

// Interception de /ajouter (navigation-ia §1.3) : overlay plein écran par-dessus
// l'onglet courant. Fermer (annuler / Échap / retour navigateur) = router.back()
// → revient exactement à l'écran d'origine, jamais un redirect vers accueil.
// RSC (même seam que (main)/page.tsx) : le formulaire a besoin du membre
// courant et des parts par défaut du foyer.
export default async function AjouterModal() {
  const ctx = await getCurrentContext();
  const defaultShares = await getDefaultShares(ctx.supabase, ctx.householdId);
  return <AddScreen currentMemberId={ctx.member.id} defaultShares={defaultShares} closeTo="back" />;
}
