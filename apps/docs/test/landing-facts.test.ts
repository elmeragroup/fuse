/**
 * The landing page states how many locales Fuse ships, read from the `SupportedLocale` union.
 * Every component dictionary ships one row file per supported locale, so the union and the
 * row files are two representations that must agree: the reader is checked against the
 * files, not against itself.
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readSupportedLocales } from "../scripts/lib/landing-facts.ts";
import { fuseSrc } from "../scripts/lib/paths.ts";

/** The locale row files beside a dictionary's `index.ts`, such as `nb-NO.ts`. */
function localeRowFiles(intlDir: string): string[] {
  return readdirSync(intlDir)
    .filter((file) => file !== "index.ts" && file.endsWith(".ts") && !file.includes(".test."))
    .map((file) => file.replace(/\.ts$/, ""));
}

describe("readSupportedLocales", () => {
  it("lists exactly the locales every component dictionary ships rows for", () => {
    const components = path.join(fuseSrc, "components");
    const dictionaries = readdirSync(components)
      .map((name) => path.join(components, name, "intl"))
      .filter((dir) => {
        try {
          return readdirSync(dir).includes("index.ts");
        } catch {
          return false;
        }
      });
    expect(dictionaries.length).toBeGreaterThan(0);

    const locales = [...readSupportedLocales()].sort();
    for (const dir of dictionaries) {
      expect(localeRowFiles(dir).sort(), path.relative(fuseSrc, dir)).toEqual(locales);
    }
  });
});
