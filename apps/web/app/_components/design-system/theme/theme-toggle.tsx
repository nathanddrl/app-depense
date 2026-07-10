"use client";

// Toggle thème global (T-C9.2), monté une fois dans le layout racine — pas de
// duplication par écran.

import { useSyncExternalStore } from "react";
import { Switch } from "../core";
import { getServerThemeSnapshot, getThemeSnapshot, setTheme, subscribeTheme } from "./theme-store";

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  return (
    <div
      style={{
        position: "fixed",
        top: "var(--space-2)",
        right: "var(--space-2)",
        zIndex: 10,
      }}
    >
      <Switch checked={isDark} onChange={setTheme} label="mode sombre" />
    </div>
  );
}
