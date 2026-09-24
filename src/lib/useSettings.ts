"use client";

import { useEffect, useState } from "react";

export type AppSettings = {
  orgName: string;
  currency: string;
  dateFormat: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  orgName: "Property CRM",
  currency: "USD",
  dateFormat: "MMM D, YYYY",
};

let cache: AppSettings | null = null;
let inflight: Promise<AppSettings> | null = null;

function loadSettings(): Promise<AppSettings> {
  const cached = cache;
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    const p: Promise<AppSettings> = fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const merged: AppSettings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
        cache = merged;
        return merged;
      })
      .catch(() => DEFAULT_SETTINGS)
      .finally(() => {
        inflight = null;
      });
    inflight = p;
    return p;
  }
  return inflight;
}

export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(cache ?? DEFAULT_SETTINGS);
  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return settings;
}

/** Preloads settings into the module cache (e.g. from the app shell so children render with them). */
export function primeSettings(s: AppSettings) {
  cache = s;
}
