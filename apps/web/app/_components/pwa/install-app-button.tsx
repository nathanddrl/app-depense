"use client";

import { useState, useSyncExternalStore } from "react";
import { Dialog } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import {
  getInstallStatusSnapshot,
  getServerInstallStatusSnapshot,
  promptInstall,
  subscribeInstallStatus,
} from "./install-prompt-store";

type Props = {
  className?: string;
};

export function InstallAppButton({ className }: Props) {
  const status = useSyncExternalStore(
    subscribeInstallStatus,
    getInstallStatusSnapshot,
    getServerInstallStatusSnapshot,
  );
  const [showInstructions, setShowInstructions] = useState(false);

  if (status === "hidden") {
    return null;
  }

  // iOS (Safari, Chrome iOS...) n'expose jamais `beforeinstallprompt` (moteur
  // WebKit imposé par Apple) : même bouton que sur Chrome/Edge, mais il ouvre
  // la procédure manuelle au lieu de déclencher un prompt qui n'existe pas.
  if (status === "ios-manual") {
    return (
      <>
        <button type="button" className={className} onClick={() => setShowInstructions(true)}>
          installer l&rsquo;application
        </button>
        <Dialog
          open={showInstructions}
          onClose={() => setShowInstructions(false)}
          title="installer l'application"
        >
          <Stack gap={2}>
            <p>1. touchez le bouton partager</p>
            <p>2. sélectionnez « sur l&rsquo;écran d&rsquo;accueil »</p>
            <p>3. validez avec ajouter</p>
          </Stack>
        </Dialog>
      </>
    );
  }

  return (
    <button type="button" className={className} onClick={promptInstall}>
      installer l&rsquo;application
    </button>
  );
}
