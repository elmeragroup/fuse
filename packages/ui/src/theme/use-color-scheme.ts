"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_ENABLE_SYSTEM,
  parseColorScheme,
  readDocumentColorScheme,
  readStoredColorScheme,
  resolveColorScheme,
  writeDocumentColorScheme,
  writeStoredColorScheme,
} from "./color-scheme";
import type { ColorScheme, ColorSchemeOptions, UseColorSchemeResult } from "./color-scheme";

export function useColorScheme(options: ColorSchemeOptions = {}): UseColorSchemeResult {
  const storageKey = options.storageKey ?? DEFAULT_COLOR_SCHEME_STORAGE_KEY;
  const defaultColorScheme = options.defaultColorScheme ?? DEFAULT_COLOR_SCHEME;
  const enableSystem = options.enableSystem ?? DEFAULT_ENABLE_SYSTEM;

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(defaultColorScheme);
  const [resolvedColorScheme, setResolvedColorScheme] = useState<"light" | "dark" | undefined>(undefined);

  useEffect(() => {
    const preference = readStoredColorScheme(storageKey, defaultColorScheme);
    const resolved = readDocumentColorScheme() ?? resolveColorScheme(preference, enableSystem);
    setColorSchemeState(preference);
    setResolvedColorScheme(resolved);
    writeDocumentColorScheme(resolved);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }
      const next = parseColorScheme(event.newValue, defaultColorScheme);
      const nextResolved = resolveColorScheme(next, enableSystem);
      setColorSchemeState(next);
      setResolvedColorScheme(nextResolved);
      writeDocumentColorScheme(nextResolved);
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [defaultColorScheme, enableSystem, storageKey]);

  useEffect(() => {
    if (!(colorScheme === "system" && enableSystem)) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = resolveColorScheme("system", true);
      setResolvedColorScheme(resolved);
      writeDocumentColorScheme(resolved);
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [colorScheme, enableSystem]);

  const setColorScheme = useCallback(
    (value: ColorScheme) => {
      const next = parseColorScheme(value, defaultColorScheme);
      const resolved = resolveColorScheme(next, enableSystem);
      setColorSchemeState(next);
      setResolvedColorScheme(resolved);
      writeStoredColorScheme(storageKey, next);
      writeDocumentColorScheme(resolved);
    },
    [defaultColorScheme, enableSystem, storageKey]
  );

  return { colorScheme, resolvedColorScheme, setColorScheme };
}
