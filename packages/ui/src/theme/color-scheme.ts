export type ColorScheme = "light" | "dark" | "system";

export type ColorSchemeOptions = {
  storageKey?: string;
  defaultColorScheme?: ColorScheme;
  enableSystem?: boolean;
};

export type ColorSchemeScriptProps = ColorSchemeOptions & { nonce?: string };

export type UseColorSchemeResult = {
  colorScheme: ColorScheme;
  resolvedColorScheme: "light" | "dark" | undefined;
  setColorScheme: (value: ColorScheme) => void;
};

export const DEFAULT_COLOR_SCHEME_STORAGE_KEY = "elmera-color-scheme";
export const DEFAULT_COLOR_SCHEME: ColorScheme = "system";
export const DEFAULT_ENABLE_SYSTEM = true;

export function parseColorScheme(value: string | null | undefined, fallback: ColorScheme): ColorScheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return fallback;
}

export function resolveSystemColorScheme(): "light" | "dark" {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function resolveColorScheme(preference: ColorScheme, enableSystem: boolean): "light" | "dark" {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  if (!enableSystem) {
    return "light";
  }
  return resolveSystemColorScheme();
}

export function readStoredColorScheme(storageKey: string, fallback: ColorScheme): ColorScheme {
  try {
    return parseColorScheme(localStorage.getItem(storageKey), fallback);
  } catch {
    return parseColorScheme(null, fallback);
  }
}

export function writeStoredColorScheme(storageKey: string, value: ColorScheme): void {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // storage unavailable
  }
}

export function readDocumentColorScheme(): "light" | "dark" | undefined {
  try {
    const value = document.documentElement.getAttribute("data-theme");
    if (value === "light" || value === "dark") {
      return value;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function writeDocumentColorScheme(value: "light" | "dark"): void {
  try {
    document.documentElement.setAttribute("data-theme", value);
  } catch {
    // document unavailable
  }
}
