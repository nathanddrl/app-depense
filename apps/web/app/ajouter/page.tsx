import { getCurrentContext } from "../../lib/auth/context";
import { getDefaultShares } from "../../lib/household";
import { AddScreen } from "../_components/add/add-screen";

// Repli plein écran (navigation-ia §1.3) : accès direct ou refresh sur /ajouter,
// hors du groupe (main) donc sans BottomNav. Pas d'origine in-app (entrée
// fraîche) → fermer ramène à l'accueil, seule destination sensée ici.
export default async function AjouterPage() {
  const ctx = await getCurrentContext();
  const defaultShares = await getDefaultShares(ctx.supabase, ctx.householdId);
  return <AddScreen currentMemberId={ctx.member.id} defaultShares={defaultShares} closeTo="home" />;
}
