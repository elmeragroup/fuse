import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { toastStrings } from "./intl";
import { Toast } from "./toast";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

describe("toast dictionary", () => {
  it("owns the locked toast.close copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(toastStrings.getStringForLocale("close", locale), locale).toBe(CLOSE_COPY[locale]);
    }
  });

  it("carries no key beyond the one row accessibility.md §4.1 assigns to Toast", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(toastStrings.getStringsForLocale(locale)), locale).toEqual(["close"]);
    }
  });
});

describe("toast manager adapter", () => {
  it("createToastManager works from non-React code", () => {
    const manager = Toast.createToastManager();
    const id = manager.add({ title: "Saved", description: "Outside the tree.", timeout: 0 });
    expect(id).toEqual(expect.any(String));
    expect(id.length).toBeGreaterThan(0);
    manager.update(id, { description: "Updated from a timer." });
    manager.close(id);
    expect(manager).not.toHaveProperty("toasts");
  });

  it("promise() returns the settled value without a React tree", async () => {
    const manager = Toast.createToastManager();
    await expect(
      manager.promise(Promise.resolve("ok"), {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      })
    ).resolves.toBe("ok");
    await expect(
      manager.promise(Promise.reject(new Error("boom")), {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      })
    ).rejects.toThrow("boom");
  });
});
