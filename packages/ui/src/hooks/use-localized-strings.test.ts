import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../scripts/entries";
import { SUPPORTED_LOCALES, withLocale } from "../../test/locale-matrix";
import { fixtureDictionary } from "./intl-fixture";
import { useLocalizedStrings } from "./use-localized-strings";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const GREETINGS = {
  "nb-NO": "Hei",
  "sv-SE": "Hej",
  "en-US": "Hello",
  "fi-FI": "Hei",
} as const;

const REMOVE_SAVE = {
  "nb-NO": "Fjern Save",
  "sv-SE": "Ta bort Save",
  "en-US": "Remove Save",
  "fi-FI": "Poista Save",
} as const;

function Probe({ override }: { override?: string }) {
  const strings = useLocalizedStrings(fixtureDictionary);
  return override ?? strings.format("greeting");
}

function RemoveProbe() {
  const strings = useLocalizedStrings(fixtureDictionary);
  return strings.format("removeItem", { item: "Save" });
}

describe("useLocalizedStrings", () => {
  it("resolves the fixture dictionary in all four locales via the locale-matrix helper", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(renderToString(withLocale(locale, createElement(Probe)))).toBe(GREETINGS[locale]);
      expect(renderToString(withLocale(locale, createElement(RemoveProbe)))).toBe(REMOVE_SAVE[locale]);
    }
  });

  it("lets an explicit string prop override the dictionary", () => {
    expect(renderToString(withLocale("nb-NO", createElement(Probe, { override: "Custom" })))).toBe("Custom");
    expect(renderToString(withLocale("en-US", createElement(Probe, { override: "Custom" })))).toBe("Custom");
  });

  it("starts with the use client directive", () => {
    const source = readFileSync(join(packageRoot, "src/hooks/use-localized-strings.ts"), "utf8");
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });

  // Timeout: discoverEntries walks the published import graph; slow under full-gate parallel load.
  it("does not add a public export for the hook", () => {
    // Source-grep: absence from the barrel has no consumer-behavior probe.
    const discovered = discoverEntries(packageRoot);
    const names = discovered.jsEntries.flatMap((entry) => [...entry.runtimeExports]);
    expect(names).not.toContain("useLocalizedStrings");
    expect(discovered.jsEntries.map((entry) => entry.subpath)).not.toContain("hooks");
    const source = readFileSync(join(packageRoot, "src/index.ts"), "utf8");
    expect(source).not.toContain("use-localized-strings");
  }, 30_000);
});
