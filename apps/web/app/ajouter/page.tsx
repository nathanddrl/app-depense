import { getCurrentContext } from "../../lib/auth/context";
import { getDefaultShares } from "../../lib/household";
import { listRecurringTemplatesAction } from "../actions";
import { AddScreen } from "../_components/add/add-screen";
import { ADD_MODE_PARAM, ADD_MODE_ONCE, ADD_MODE_RECURRENT } from "../_components/add/add-mode";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

// Repli plein écran (navigation-ia §1.3) : accès direct ou refresh sur /ajouter,
// hors du groupe (main) donc sans BottomNav. Pas d'origine in-app (entrée
// fraîche) → fermer ramène à l'accueil, seule destination sensée ici.
// `?mode=recurrent` (T-CN2.2) ouvre directement sur l'onglet récurrent (T-CN4.2).
export default async function AjouterPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialMode = sp[ADD_MODE_PARAM] === ADD_MODE_RECURRENT ? ADD_MODE_RECURRENT : ADD_MODE_ONCE;

  const ctx = await getCurrentContext();
  const [defaultShares, templatesResult] = await Promise.all([
    getDefaultShares(ctx.supabase, ctx.householdId),
    listRecurringTemplatesAction(),
  ]);

  return (
    <AddScreen
      currentMemberId={ctx.member.id}
      defaultShares={defaultShares}
      templates={templatesResult.ok ? templatesResult.data : []}
      closeTo="home"
      initialMode={initialMode}
    />
  );
}
