"use client";

import { createContext, useEffect, useInsertionEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { resolveColorSchemeOptions } from "./color-scheme";
import type { ColorSchemeOptions, ColorSchemeScriptElementProps, UseColorSchemeResult } from "./color-scheme";
import { createBrowserColorSchemePlatform } from "./color-scheme-browser-platform";
import { diagnoseColorSchemeBootstrap } from "./color-scheme-diagnostics";
import { createColorSchemeRuntime } from "./color-scheme-runtime";
import type { ColorSchemeRuntime, ColorSchemeRuntimeConfig } from "./color-scheme-runtime";
import { InjectedColorSchemeScript } from "./color-scheme-script";

/** The document's color-scheme snapshot, provided by the one `ColorSchemeRoot`. */
export const ColorSchemeContext = createContext<UseColorSchemeResult | undefined>(undefined);

/** The runtime's `force`, for `ForceColorScheme`; `undefined` outside a `ColorSchemeRoot`. */
export const ColorSchemeForceContext = createContext<ColorSchemeRuntime["force"] | undefined>(undefined);

/** How many `ForceColorScheme` boundaries enclose a subtree. */
export const ColorSchemeForceDepthContext = createContext(0);

/**
 * `ThemeProvider`'s color-scheme props. Declared apart from `ThemeProviderProps` so that
 * public type keeps its exact text; a type test pins that the provider's props fit here.
 */
export type ColorSchemeRootProps = ColorSchemeOptions & {
  /** The subtree that reads or forces the color scheme. */
  children: ReactNode;
  /** Suppress CSS transitions for every runtime `data-theme` write. */
  disableTransitionOnChange?: boolean;
  /** Render the bootstrap script instead of expecting the host to place it. */
  injectColorSchemeScript?: boolean;
  /** The CSP nonce for the injected script and the transition-suppression style. */
  nonce?: string;
  /** Extra attributes for the injected script. */
  scriptProps?: ColorSchemeScriptElementProps;
};

/**
 * Owns the document's color-scheme runtime: it creates it over the browser platform,
 * configures it in the insertion phase of every commit, connects it after mount, runs the
 * one-time bootstrap diagnostics and renders the injected script. Render it exactly once
 * per document, above everything that reads the color scheme.
 *
 * @param props - The color-scheme options and the subtree.
 * @returns The subtree inside the color-scheme contexts.
 */
export function ColorSchemeRoot({
  children,
  storageKey,
  defaultColorScheme,
  enableSystem,
  forcedColorScheme,
  disableTransitionOnChange = false,
  injectColorSchemeScript = false,
  nonce,
  scriptProps,
}: ColorSchemeRootProps) {
  const manifest = resolveColorSchemeOptions({
    storageKey,
    defaultColorScheme,
    enableSystem,
    forcedColorScheme,
  });
  const config: ColorSchemeRuntimeConfig = { ...manifest, disableTransitionOnChange, nonce };
  const [runtime] = useState(() => createColorSchemeRuntime(config, createBrowserColorSchemePlatform()));
  const colorScheme = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getServerSnapshot);
  const diagnosed = useRef(false);

  // No dependency list on purpose: every commit re-runs configure, which is free for an equal
  // config but still corrects a data-theme that host code overwrote. The insertion phase runs
  // before descendant layout effects, and a suspended render never reaches it.
  useInsertionEffect(() => {
    runtime.configure(config);
    if (!diagnosed.current) {
      diagnosed.current = true;
      diagnoseColorSchemeBootstrap(manifest, injectColorSchemeScript);
    }
  });

  useEffect(() => runtime.connect(), [runtime]);

  return (
    <ColorSchemeContext.Provider value={colorScheme}>
      <ColorSchemeForceContext.Provider value={runtime.force}>
        {injectColorSchemeScript ? (
          <InjectedColorSchemeScript {...manifest} nonce={nonce} scriptProps={scriptProps} />
        ) : null}
        {children}
      </ColorSchemeForceContext.Provider>
    </ColorSchemeContext.Provider>
  );
}
