"use client";

// Toggle thème (T-C9.2), affiché dans /reglages uniquement — pas de montage
// global ni de duplication par écran.

import { useSyncExternalStore } from "react";
import { Switch } from "../core";
import { getServerThemeSnapshot, getThemeSnapshot, setTheme, subscribeTheme } from "./theme-store";

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  return <Switch checked={isDark} onChange={setTheme} label="mode sombre" />;
}
