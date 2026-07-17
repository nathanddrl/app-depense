"use client";

// Changement de son propre mot de passe depuis les réglages (T-CN…), sans passer
// par le dashboard Supabase. Trois champs (actuel / nouveau / confirmation),
// validation client d'abord (nouveau = confirmation), puis modale de confirmation
// à copie neutre. Vérification du mot de passe actuel via signInWithPassword
// (Supabase n'expose pas de vérification isolée), puis updateUser.
//
// Aucune règle de longueur/complexité côté app : la politique exacte configurée
// sur le dashboard n'a pas été vérifiée, donc on affiche tel quel le message
// d'erreur renvoyé par Supabase. Ton de succès proscrit (contrainte Notice) :
// la confirmation reste tone="neutral".

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Button, Input } from "../../_components/design-system/core";
import { Dialog, Notice } from "../../_components/design-system/feedback";
import { Stack } from "../../_components/design-system/layout";
import styles from "./reglages.module.css";

type Props = {
  /** Email du compte courant — sert de login pour vérifier le mot de passe actuel. */
  email: string;
};

// Ton d'un message : erreur (rouge, role=alert) ou neutre (confirmation incluse).
type Feedback = { tone: "neutral" | "error"; message: string } | null;

export function PasswordSection({ email }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  // Erreur inline de champ (nouveau ≠ confirmation) — jamais de réseau, jamais de modale.
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirmation("");
  };

  // Étape 1 (soumission du formulaire) : validation purement client. Si le nouveau
  // mot de passe ne correspond pas à sa confirmation, erreur inline immédiate et
  // on n'ouvre même pas la modale — aucun appel réseau.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (next !== confirmation) {
      setMismatchError("le nouveau mot de passe et sa confirmation ne correspondent pas");
      return;
    }
    setMismatchError(null);
    setConfirmOpen(true);
  };

  // Étape 2 (confirmation dans la modale) : on vérifie d'abord le mot de passe
  // actuel via une reconnexion, puis on applique le nouveau.
  const handleConfirm = async () => {
    setConfirmOpen(false);
    setPending(true);
    setFeedback(null);
    const supabase = createSupabaseBrowserClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInError) {
      setFeedback({ tone: "error", message: "mot de passe actuel incorrect" });
      setPending(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    if (updateError) {
      // Message Supabase tel quel (politique de longueur/complexité côté dashboard) —
      // on n'invente aucune règle de validation côté app.
      setFeedback({ tone: "error", message: updateError.message });
      setPending(false);
      return;
    }

    // Jamais de ton succès (contrainte Notice) : confirmation neutre, champs vidés.
    setFeedback({ tone: "neutral", message: "mot de passe mis à jour" });
    reset();
    setPending(false);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.passwordSection}>
      <Stack gap={3}>
        <Input
          label="mot de passe actuel"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Input
          label="nouveau mot de passe"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="confirmer le nouveau mot de passe"
          type="password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
          required
        />
        {mismatchError ? <Notice tone="error">{mismatchError}</Notice> : null}
        {feedback ? <Notice tone={feedback.tone}>{feedback.message}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "changement en cours…" : "changer le mot de passe"}
        </Button>
      </Stack>

      <Dialog open={confirmOpen} title="changer le mot de passe ?">
        <Stack gap={3}>
          <Notice tone="neutral">le mot de passe de ce compte va être remplacé.</Notice>
          <Stack gap={2} direction="row">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              annuler
            </Button>
            <Button onClick={handleConfirm}>confirmer</Button>
          </Stack>
        </Stack>
      </Dialog>
    </form>
  );
}
