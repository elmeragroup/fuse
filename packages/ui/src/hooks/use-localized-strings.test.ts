import { createElement } from "react";

import type { LocalizedStringFormatter } from "@internationalized/string";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../scripts/entries";
import { SUPPORTED_LOCALES, withLocale } from "../../test/locale-matrix";
import { createStringDictionary } from "./create-string-dictionary";
import { fixtureDictionary } from "./intl-fixture";
import { enUS } from "./intl-fixture/en-US";
import { fiFI } from "./intl-fixture/fi-FI";
import { nbNO } from "./intl-fixture/nb-NO";
import { svSE } from "./intl-fixture/sv-SE";
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

function DualProbe() {
  const first = useLocalizedStrings(fixtureDictionary);
  const second = useLocalizedStrings(fixtureDictionary);
  return first === second ? "shared" : "allocated";
}

// A second dictionary over the same rows: two `createStringDictionary` calls are two
// objects, so this pins the cache to dictionary identity rather than to row content.
const otherDictionary = createStringDictionary({ enUS, fiFI, nbNO, svSE });

function CaptureProbe({
  dictionary,
  onFormatter,
}: {
  dictionary: typeof fixtureDictionary;
  onFormatter: (formatter: LocalizedStringFormatter) => void;
}) {
  onFormatter(useLocalizedStrings(dictionary));
  return null;
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

  it("returns the same formatter instance for the same dictionary and locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(renderToString(withLocale(locale, createElement(DualProbe)))).toBe("shared");
    }

    const firstLocale: LocalizedStringFormatter[] = [];
    renderToString(
      withLocale(
        "en-US",
        createElement(CaptureProbe, {
          dictionary: fixtureDictionary,
          onFormatter: (formatter) => {
            firstLocale.push(formatter);
          },
        })
      )
    );
    renderToString(
      withLocale(
        "en-US",
        createElement(CaptureProbe, {
          dictionary: fixtureDictionary,
          onFormatter: (formatter) => {
            firstLocale.push(formatter);
          },
        })
      )
    );
    expect(firstLocale[0]).toBe(firstLocale[1]);

    const otherLocale: LocalizedStringFormatter[] = [];
    renderToString(
      withLocale(
        "nb-NO",
        createElement(CaptureProbe, {
          dictionary: fixtureDictionary,
          onFormatter: (formatter) => {
            otherLocale.push(formatter);
          },
        })
      )
    );
    expect(otherLocale[0]).not.toBe(firstLocale[0]);

    const otherDict: LocalizedStringFormatter[] = [];
    renderToString(
      withLocale(
        "en-US",
        createElement(CaptureProbe, {
          dictionary: otherDictionary,
          onFormatter: (formatter) => {
            otherDict.push(formatter);
          },
        })
      )
    );
    expect(otherDict[0]).not.toBe(firstLocale[0]);
  });

  // Timeout: discoverEntries walks the published import graph; slow under full-gate parallel load.
  it("does not add a public export for the hook", () => {
    const discovered = discoverEntries(packageRoot);
    const names = discovered.jsEntries.flatMap((entry) => [...entry.runtimeExports]);
    expect(names).not.toContain("useLocalizedStrings");
    expect(discovered.jsEntries.map((entry) => entry.subpath)).not.toContain("hooks");
  }, 30_000);
});
