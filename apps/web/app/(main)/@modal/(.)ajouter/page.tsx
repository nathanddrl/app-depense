import { getCurrentContext } from "../../../../lib/auth/context";
import { getDefaultShares } from "../../../../lib/household";
import { listRecurringTemplatesAction } from "../../../actions";
import { AddScreen } from "../../../_components/add/add-screen";
import { ADD_MODE_PARAM, ADD_MODE_ONCE, ADD_MODE_RECURRENT } from "../../../_components/add/add-mode";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

// Interception de /ajouter (navigation-ia §1.3) : overlay plein écran par-dessus
// l'onglet courant. Fermer (annuler / Échap / retour navigateur) = router.back()
// → revient exactement à l'écran d'origine, jamais un redirect vers accueil.
// RSC (même seam que (main)/page.tsx) : le formulaire a besoin du membre
// courant, des parts par défaut du foyer et des charges récurrentes déjà
// posées (T-CN4.2 : le Tabs récurrent peut s'ouvrir directement sans nouvelle
// navigation, la liste doit donc déjà être là). `?mode=recurrent` (T-CN2.2,
// `recurrence-invite.tsx`) ouvre directement sur l'onglet récurrent.
export default async function AjouterModal({ searchParams }: Props) {
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
      closeTo="back"
      initialMode={initialMode}
    />
  );
}
