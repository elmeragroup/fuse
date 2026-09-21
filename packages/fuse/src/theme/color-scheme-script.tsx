/**
 * ColorSchemeScript is adapted from next-themes (https://github.com/pacocoursey/next-themes).
 *
 * MIT License
 * Copyright (c) 2022 Paco Coursey
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { FunctionComponent, ReactNode, ScriptHTMLAttributes } from "react";

import {
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DESCRIPTION,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_ENABLE_SYSTEM,
  resolveColorSchemeOptions,
  serializeScriptData,
} from "./color-scheme";
import type {
  ColorScheme,
  ColorSchemeOptions,
  ColorSchemeScriptElementProps,
  ColorSchemeScriptProps,
} from "./color-scheme";

type ColorSchemeScriptPassthrough = {
  nonce: string | undefined;
  passthrough: ColorSchemeScriptElementProps;
};

type IncomingColorSchemeScriptProps = ColorSchemeScriptElementProps & {
  type?: ScriptHTMLAttributes<HTMLScriptElement>["type"];
  src?: ScriptHTMLAttributes<HTMLScriptElement>["src"];
  children?: ReactNode;
  dangerouslySetInnerHTML?: ScriptHTMLAttributes<HTMLScriptElement>["dangerouslySetInnerHTML"];
};

function serializeScriptArgument(value: string | boolean | undefined): string {
  if (value === undefined) {
    return "undefined";
  }
  return serializeScriptData(value);
}

function scriptPassthroughProps(
  scriptProps: IncomingColorSchemeScriptProps | undefined
): ColorSchemeScriptPassthrough {
  if (scriptProps === undefined) {
    return { nonce: undefined, passthrough: {} };
  }

  const {
    type: _type,
    src: _src,
    children: _children,
    dangerouslySetInnerHTML: _dangerouslySetInnerHTML,
    nonce: scriptNonce,
    ...passthrough
  } = scriptProps;
  void _type;
  void _src;
  void _children;
  void _dangerouslySetInnerHTML;

  return { nonce: scriptNonce, passthrough };
}

function applyClosedColorSchemeBootstrap(
  storageKey: string,
  defaultColorScheme: ColorScheme,
  enableSystem: boolean,
  forcedColorScheme: ColorScheme | undefined
): void {
  try {
    let preference: string = defaultColorScheme;
    if (preference !== "light" && preference !== "dark" && preference !== "system") {
      preference = "system";
    }

    const force =
      forcedColorScheme === "light" || forcedColorScheme === "dark" || forcedColorScheme === "system"
        ? forcedColorScheme
        : undefined;

    if (force !== undefined) {
      preference = force;
    } else {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored === "light" || stored === "dark" || stored === "system") {
          preference = stored;
        }
      } catch {
        // storage unavailable
      }
    }

    let resolved = "light";
    if (preference === "light" || preference === "dark") {
      resolved = preference;
    } else if (enableSystem) {
      try {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } catch {
        resolved = "light";
      }
    }

    document.documentElement.setAttribute("data-theme", resolved);
    globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__ = {
      storageKey,
      defaultColorScheme,
      enableSystem,
      forcedColorScheme,
    };
  } catch {
    // never throw before paint
  }
}

export function colorSchemeScriptSource(options: ColorSchemeOptions = {}): string {
  const { storageKey, defaultColorScheme, enableSystem, forcedColorScheme } =
    resolveColorSchemeOptions(options);
  return `(${applyClosedColorSchemeBootstrap.toString()})(${serializeScriptArgument(storageKey)},${serializeScriptArgument(defaultColorScheme)},${serializeScriptArgument(enableSystem)},${serializeScriptArgument(forcedColorScheme)})`;
}

export function injectedColorSchemeScriptSource(options: ColorSchemeOptions = {}): string {
  const inner = colorSchemeScriptSource(options);
  const sourceKey = JSON.stringify(COLOR_SCHEME_BOOTSTRAP_SOURCE_DESCRIPTION);
  const provider = JSON.stringify(COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER);
  const duplicate = JSON.stringify(COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE);
  return `(function(){var h=typeof globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__!=="undefined";${inner};var m=globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__;if(m)Object.defineProperty(m,Symbol.for(${sourceKey}),{value:h?${duplicate}:${provider}})})()`;
}

function ColorSchemeScriptMarkup({
  nonce,
  scriptProps,
  source,
}: ColorSchemeScriptProps & { source: string }) {
  const { nonce: scriptNonce, passthrough } = scriptPassthroughProps(scriptProps);

  return (
    <script
      {...passthrough}
      nonce={nonce ?? scriptNonce}
      dangerouslySetInnerHTML={{
        __html: source,
      }}
    />
  );
}

export const ColorSchemeScript: FunctionComponent<ColorSchemeScriptProps> = ({
  storageKey = DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  defaultColorScheme = DEFAULT_COLOR_SCHEME,
  enableSystem = DEFAULT_ENABLE_SYSTEM,
  forcedColorScheme,
  nonce,
  scriptProps,
}) => (
  <ColorSchemeScriptMarkup
    nonce={nonce}
    scriptProps={scriptProps}
    source={colorSchemeScriptSource({
      storageKey,
      defaultColorScheme,
      enableSystem,
      forcedColorScheme,
    })}
  />
);

export function InjectedColorSchemeScript({
  storageKey = DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  defaultColorScheme = DEFAULT_COLOR_SCHEME,
  enableSystem = DEFAULT_ENABLE_SYSTEM,
  forcedColorScheme,
  nonce,
  scriptProps,
}: ColorSchemeScriptProps) {
  return (
    <ColorSchemeScriptMarkup
      nonce={nonce}
      scriptProps={scriptProps}
      source={injectedColorSchemeScriptSource({
        storageKey,
        defaultColorScheme,
        enableSystem,
        forcedColorScheme,
      })}
    />
  );
}
