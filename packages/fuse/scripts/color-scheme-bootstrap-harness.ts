import { runInNewContext } from "node:vm";

import type { ColorSchemeBootstrapManifest } from "../src/theme/color-scheme";
import { COLOR_SCHEME_BOOTSTRAP_MANIFEST_KEY } from "../src/theme/color-scheme";

export type ColorSchemeBootstrapEvalOptions = {
  storedValue?: string | null;
  prefersDark?: boolean;
  existingManifest?: ColorSchemeBootstrapManifest;
};

export type ColorSchemeBootstrapEvalResult = {
  attributes: { [name: string]: string };
  style: { [name: string]: string };
  storageReads: string[];
  createdElements: string[];
  manifest: ColorSchemeBootstrapManifest | undefined;
};

type MediaQueryMatches = {
  matches: boolean;
};

type ColorSchemeBootstrapSandbox = {
  document: {
    documentElement: {
      attributes: { [name: string]: string };
      style: { [name: string]: string };
      setAttribute: (name: string, value: string) => void;
      getAttribute: (name: string) => string | null;
    };
    createElement: (tagName: string) => never;
    head: { append: (node: never) => void };
  };
  localStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
  window: {
    matchMedia: (query: string) => MediaQueryMatches;
  };
  [COLOR_SCHEME_BOOTSTRAP_MANIFEST_KEY]?: ColorSchemeBootstrapManifest;
};

export function evaluateColorSchemeBootstrapScript(
  source: string,
  options: ColorSchemeBootstrapEvalOptions = {}
): ColorSchemeBootstrapEvalResult {
  const attributes: { [name: string]: string } = {};
  const style: { [name: string]: string } = {};
  const storageReads: string[] = [];
  const createdElements: string[] = [];
  const storedValue = options.storedValue ?? null;
  const prefersDark = options.prefersDark === true;

  const sandbox: ColorSchemeBootstrapSandbox = {
    document: {
      documentElement: {
        attributes,
        style,
        setAttribute(name: string, value: string): void {
          attributes[name] = value;
        },
        getAttribute(name: string): string | null {
          return attributes[name] ?? null;
        },
      },
      createElement(tagName: string): never {
        createdElements.push(tagName);
        throw new Error(`document.createElement(${tagName}) is not available in the bootstrap harness`);
      },
      head: {
        append(): void {
          throw new Error("document.head.append is not available in the bootstrap harness");
        },
      },
    },
    localStorage: {
      getItem(key: string): string | null {
        storageReads.push(key);
        return storedValue;
      },
      setItem(): void {
        throw new Error("localStorage.setItem must not run in the color-scheme bootstrap");
      },
    },
    window: {
      matchMedia(query: string): MediaQueryMatches {
        if (query !== "(prefers-color-scheme: dark)") {
          throw new Error(`Unexpected matchMedia query: ${query}`);
        }
        return { matches: prefersDark };
      },
    },
  };

  if (options.existingManifest !== undefined) {
    sandbox[COLOR_SCHEME_BOOTSTRAP_MANIFEST_KEY] = options.existingManifest;
  }

  runInNewContext(source, sandbox, { timeout: 1000 });

  return {
    attributes,
    style,
    storageReads,
    createdElements,
    manifest: sandbox[COLOR_SCHEME_BOOTSTRAP_MANIFEST_KEY],
  };
}
