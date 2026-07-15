export type AppTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "nxo-theme";

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "dark" || value === "light";
}

export function readStoredTheme(): AppTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function applyThemeToDocument(theme: AppTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme: AppTheme): void {
  applyThemeToDocument(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Inline script for root layout — runs before paint to avoid flash. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark")t="dark";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark";}})();`;
