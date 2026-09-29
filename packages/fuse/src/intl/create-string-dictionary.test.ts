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
  it("falls back to en-US for a locale the library does not ship", () => {
    const dictionary = createStringDictionary(rows);
    expect(dictionary.getStringForLocale("close", "de-DE")).toBe("Close");
  });
});
