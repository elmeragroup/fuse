import { LocalizedStringFormatter } from "@internationalized/string";
import type { Variables } from "@internationalized/string";
import { describe, expect, it } from "vitest";

import { createStringDictionary } from "./create-string-dictionary";

const rows = {
  enUS: { close: "Close", greet: (vars: Variables) => `Hi ${String(vars?.name ?? "")}` },
  fiFI: { close: "Sulje", greet: (vars: Variables) => `Moi ${String(vars?.name ?? "")}` },
  nbNO: { close: "Lukk", greet: (vars: Variables) => `Hei ${String(vars?.name ?? "")}` },
  svSE: { close: "Stäng", greet: (vars: Variables) => `Hej ${String(vars?.name ?? "")}` },
};

describe("createStringDictionary", () => {
  it("registers all four supported locales under their BCP-47 tags", () => {
    const dictionary = createStringDictionary(rows);
    expect(dictionary.getStringForLocale("close", "en-US")).toBe("Close");
    expect(dictionary.getStringForLocale("close", "fi-FI")).toBe("Sulje");
    expect(dictionary.getStringForLocale("close", "nb-NO")).toBe("Lukk");
    expect(dictionary.getStringForLocale("close", "sv-SE")).toBe("Stäng");
  });

  it("keeps parameterized rows formattable in each locale", () => {
    const dictionary = createStringDictionary(rows);
    expect(new LocalizedStringFormatter("nb-NO", dictionary).format("greet", { name: "Ada" })).toBe(
      "Hei Ada"
    );
    expect(new LocalizedStringFormatter("sv-SE", dictionary).format("greet", { name: "Ada" })).toBe(
      "Hej Ada"
    );
  });

  it("falls back to en-US for a locale the library does not ship", () => {
    const dictionary = createStringDictionary(rows);
    expect(dictionary.getStringForLocale("close", "de-DE")).toBe("Close");
  });
});
