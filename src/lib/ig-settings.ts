import { useCallback, useEffect, useState } from "react";

export type IgSettings = {
  igAccountId: string;
  accessToken: string;
};

const KEY = "kerjaku.ig.settings";
const EMPTY: IgSettings = { igAccountId: "", accessToken: "" };

export function readSettings(): IgSettings {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<IgSettings>) };
  } catch {
    return EMPTY;
  }
}

export function writeSettings(value: IgSettings) {
  window.localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new Event("kerjaku-settings"));
}

export function useIgSettings() {
  const [settings, setSettings] = useState<IgSettings>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setSettings(readSettings());
    sync();
    setLoaded(true);
    window.addEventListener("kerjaku-settings", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("kerjaku-settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((value: IgSettings) => {
    writeSettings(value);
    setSettings(value);
  }, []);

  return { settings, save, loaded, configured: Boolean(settings.igAccountId && settings.accessToken) };
}
