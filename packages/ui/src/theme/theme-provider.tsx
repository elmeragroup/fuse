"use client";

import {
  use,
  useCallback,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import {
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_ENABLE_SYSTEM,
  parseColorScheme,
  readStoredColorScheme,
  resolveColorSchemeOptions,
} from "./color-scheme";
import type { ColorScheme, ColorSchemeOptions, ColorSchemeScriptElementProps } from "./color-scheme";
import { ColorSchemeContext, ColorSchemeControllerContext } from "./color-scheme-context";
import type { ColorSchemeController } from "./color-scheme-context";
import { diagnoseColorSchemeBootstrap } from "./color-scheme-diagnostics";
import { createColorSchemeRuntimeStore } from "./color-scheme-runtime";
import type { ColorSchemeRuntimeConfig } from "./color-scheme-runtime";
import { InjectedColorSchemeScript } from "./color-scheme-script";
import { DocumentWriterContext, echoDocumentBrandAttributes } from "./document-writer";
import { themeAttributes } from "./theme-attributes";
import { ThemeContext, useResolvedTheme } from "./theme-context";
import type { Theme } from "./theme-context";
import type { ThemeInput } from "./tokens/themes";

export type ThemeProviderProps = ColorSchemeOptions & {
  theme: ThemeInput;
  children: ReactNode;
  disableTransitionOnChange?: boolean;
  injectColorSchemeScript?: boolean;
  nonce?: string;
  scriptProps?: ColorSchemeScriptElementProps;
};

export function ThemeProvider(props: ThemeProviderProps) {
  const hasDocumentWriter = use(DocumentWriterContext);
  if (hasDocumentWriter) {
    return props.children;
  }
  return <DocumentThemeWriter {...props} />;
}

function DocumentThemeWriter({
  theme,
  children,
  storageKey = DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  defaultColorScheme = DEFAULT_COLOR_SCHEME,
  enableSystem = DEFAULT_ENABLE_SYSTEM,
  forcedColorScheme,
  disableTransitionOnChange = false,
  injectColorSchemeScript = false,
  nonce,
  scriptProps,
}: ThemeProviderProps) {
  const diagnosed = useRef(false);
  // SAFETY: untyped CMS/env input is the §7.6 boundary; optional axis reads keep insertion deps from
  // throwing before remaining hooks register.
  const themeAxes = theme as ThemeInput | null;
  const options = useMemo(
    () =>
      resolveColorSchemeOptions({
        storageKey,
        defaultColorScheme,
        enableSystem,
        forcedColorScheme,
      }),
    [defaultColorScheme, enableSystem, forcedColorScheme, storageKey]
  );
  const runtimeConfig = useMemo(
    (): ColorSchemeRuntimeConfig => ({
      storageKey: options.storageKey,
      defaultColorScheme: options.defaultColorScheme,
      enableSystem: options.enableSystem,
      mountForce: options.forcedColorScheme,
      disableTransitionOnChange,
      nonce,
    }),
    [disableTransitionOnChange, nonce, options]
  );
  const [store] = useState(() => createColorSchemeRuntimeStore(runtimeConfig));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useInsertionEffect(() => {
    store.applyConfig(runtimeConfig);
    store.commitConfig();
    const attributes = themeAttributes(theme);
    const shouldDiagnose = !diagnosed.current;
    diagnosed.current = true;
    // Insertion runs before descendant useLayoutEffect so children never measure stale brand.
    echoDocumentBrandAttributes(attributes, shouldDiagnose);
    if (shouldDiagnose) {
      diagnoseColorSchemeBootstrap(options, injectColorSchemeScript);
    }
    // Skip unforced preference writes until mounted so the host bootstrap is not overwritten.
    store.applyDocument();
    // Axis primitives, not object identity: equal inline theme literals must not rewrite the document.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [
    injectColorSchemeScript,
    options,
    runtimeConfig,
    store,
    themeAxes?.brand,
    themeAxes?.segment,
    themeAxes?.variant,
  ]);

  useEffect(() => {
    store.markMounted();
    store.hydratePreference(readStoredColorScheme(options.storageKey, options.defaultColorScheme));
    store.recoverDocument();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== options.storageKey) {
        return;
      }
      store.receivePreference(parseColorScheme(event.newValue, options.defaultColorScheme));
    };

    const onMedia = () => {
      store.bumpSystem();
    };

    const media = options.enableSystem ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    window.addEventListener("storage", onStorage);
    media?.addEventListener("change", onMedia);
    return () => {
      window.removeEventListener("storage", onStorage);
      media?.removeEventListener("change", onMedia);
    };
  }, [options.defaultColorScheme, options.enableSystem, options.storageKey, store]);

  const setColorScheme = useCallback(
    (value: ColorScheme) => {
      store.setPreference(value);
    },
    [store]
  );

  const controller = useMemo((): ColorSchemeController => {
    return {
      setRuntimeForce: store.setRuntimeForce,
    };
  }, [store]);

  const colorSchemeValue = useMemo(() => {
    return {
      colorScheme: snapshot.preference,
      resolvedColorScheme: snapshot.resolvedColorScheme,
      setColorScheme,
    };
  }, [setColorScheme, snapshot]);

  const value = useResolvedTheme(theme);

  return (
    <DocumentWriterContext.Provider value={true}>
      <ThemeContext.Provider value={value}>
        <ColorSchemeContext.Provider value={colorSchemeValue}>
          <ColorSchemeControllerContext.Provider value={controller}>
            {injectColorSchemeScript ? (
              <InjectedColorSchemeScript
                storageKey={options.storageKey}
                defaultColorScheme={options.defaultColorScheme}
                enableSystem={options.enableSystem}
                forcedColorScheme={options.forcedColorScheme}
                nonce={nonce}
                scriptProps={scriptProps}
              />
            ) : null}
            {children}
          </ColorSchemeControllerContext.Provider>
        </ColorSchemeContext.Provider>
      </ThemeContext.Provider>
    </DocumentWriterContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (theme === undefined) {
    throw new Error("useTheme must be used within ThemeProvider or ThemeScope");
  }
  return theme;
}
