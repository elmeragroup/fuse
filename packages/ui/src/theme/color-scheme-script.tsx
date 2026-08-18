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

import {
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_ENABLE_SYSTEM,
} from "./color-scheme";
import type { ColorSchemeScriptProps } from "./color-scheme";

export function applyColorSchemeAttribute(
  storageKey: string,
  defaultColorScheme: string,
  enableSystem: boolean
): void {
  try {
    let preference = defaultColorScheme;
    if (preference !== "light" && preference !== "dark" && preference !== "system") {
      preference = "system";
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "light" || stored === "dark" || stored === "system") {
        preference = stored;
      }
    } catch {
      // storage unavailable
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
  } catch {
    // never throw before paint
  }
}

export function colorSchemeScriptSource({
  storageKey = DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  defaultColorScheme = DEFAULT_COLOR_SCHEME,
  enableSystem = DEFAULT_ENABLE_SYSTEM,
}: ColorSchemeScriptProps = {}): string {
  return `(${applyColorSchemeAttribute.toString()})(${JSON.stringify(storageKey)},${JSON.stringify(defaultColorScheme)},${JSON.stringify(enableSystem)})`;
}

export function ColorSchemeScript({
  storageKey = DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  defaultColorScheme = DEFAULT_COLOR_SCHEME,
  enableSystem = DEFAULT_ENABLE_SYSTEM,
  nonce,
}: ColorSchemeScriptProps = {}) {
  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: colorSchemeScriptSource({ storageKey, defaultColorScheme, enableSystem }),
      }}
    />
  );
}
