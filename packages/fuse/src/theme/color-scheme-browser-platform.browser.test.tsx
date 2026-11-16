import { afterEach, describe, expect, it } from "vitest";

import { resetThemeDocument } from "../../test/theme-browser-fixtures";
import { createBrowserColorSchemePlatform } from "./color-scheme-browser-platform";

afterEach(() => {
  resetThemeDocument();
});

function transitionStyleCount() {
  // The transition lock injects a <style> with no role, so the test counts it by its text.
  return [...document.head.querySelectorAll("style")].filter((style) =>
    style.textContent.includes("transition:none")
  ).length;
}

describe("browser adapter transition suppression", () => {
  it("wraps a suppressed write in a nonce'd style and removes it afterwards", async () => {
    const platform = createBrowserColorSchemePlatform();
    document.documentElement.setAttribute("data-theme", "light");

    platform.root.write("dark", undefined);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(transitionStyleCount()).toBe(0);

    platform.root.write("light", { nonce: "csp" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(transitionStyleCount()).toBe(1);
    // The injected transition lock is a <style> with a nonce and no role.
    const injected = [...document.head.querySelectorAll("style")].find((style) =>
      style.textContent.includes("transition:none")
    );
    expect(injected?.getAttribute("nonce")).toBe("csp");
    await expect.poll(() => transitionStyleCount()).toBe(0);
  });
});
