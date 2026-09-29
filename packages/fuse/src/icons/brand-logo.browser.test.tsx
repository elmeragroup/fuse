import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "../../test/browser-render";
import { roleNamed } from "../../test/themed-browser-render";
import { BRAND_CODES, BRANDS } from "../theme/tokens/themes";
import type { ThemeInput } from "../theme/tokens/themes";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("uses an explicit title as the accessible name without inventing a mark", () => {
    render(<BrandLogo brand="elma" variant="mark" title="Elmera Group" />);
    const img = page.getByRole("img", { name: "Elmera Group", exact: true }).element();
    expect(img.textContent).toBe("Elmera");
    expect(img.querySelector("svg")).toBeNull();
    expect(img.querySelector("path")).toBeNull();
  });

  it("lets an explicit aria-label win over the title and the display name", () => {
    render(
      <>
        <BrandLogo brand="fkas" aria-label="Home" />
        <BrandLogo brand="elma" title="Elmera Group" aria-label="Group home" />
      </>
    );
    expect(roleNamed("img", "Home").getAttribute("data-variant")).toBe("full");
    expect(roleNamed("img", "Group home").textContent).toBe("Elmera");
    expect(page.getByRole("img", { name: "Fjordkraft", exact: true }).query()).toBeNull();
    expect(page.getByRole("img", { name: "Elmera Group", exact: true }).query()).toBeNull();
  });

  it("keeps the display name when aria-label is undefined", () => {
    render(<BrandLogo brand="fkas" aria-label={undefined} />);
    expect(roleNamed("img", "Fjordkraft").getAttribute("data-variant")).toBe("full");
  });

  it("names every brand by its display name and defaults to the full variant", () => {
    expect(BRAND_CODES).toContain("elma");
    for (const brand of BRAND_CODES) {
      // Oracle: the brand display name, which theme-api.test.ts pins by hand.
      const name = BRANDS[brand].displayName;
      const { host, unmount } = render(<BrandLogo brand={brand} />);
      const img = page.getByRole("img", { name, exact: true }).element();
      expect(img.tagName).toBe("SPAN");
      expect(img.getAttribute("data-variant")).toBe("full");
      expect(img.getAttribute("role")).toBe("img");
      expect(img.getAttribute("aria-label")).toBe(name);
      if (brand === "elma") {
        expect(img.textContent).toBe(name);
        expect(host.querySelector("svg")).toBeNull();
      } else {
        expect(host.querySelector("svg")).not.toBeNull();
      }
      unmount();
    }
  });

  it("throws an explicit error for an unknown brand code", () => {
    // React 19 createRoot + flushSync reports render errors as unhandled instead of
    // rethrowing to the caller, so assert the throw on the component function.
    // SAFETY: runtime rejection is the contract under test; the public type is BrandCode.
    expect(() => BrandLogo({ brand: "zz" as ThemeInput["brand"] })).toThrow(/Unhandled brand: zz/);
  });

  it("applies advertised fallback-host props on the rendered span", () => {
    const { host } = render(
      <BrandLogo
        brand="elma"
        variant="mark"
        title="Elmera Group"
        id="brand-logo"
        className="logo"
        lang="nb"
        hidden
        style={{ color: "red" }}
        tabIndex={0}
      />
    );

    const img = host.querySelector('[role="img"]');
    if (!(img instanceof HTMLElement)) {
      throw new Error("expected BrandLogo fallback host");
    }
    expect(img.tagName).toBe("SPAN");
    expect(img.id).toBe("brand-logo");
    expect(img.className).toBe("logo");
    expect(img.lang).toBe("nb");
    expect(img.hidden).toBe(true);
    expect(img.style.color).toBe("red");
    expect(img.tabIndex).toBe(0);
    expect(img.getAttribute("data-variant")).toBe("mark");
    expect(img.textContent).toBe("Elmera");
    expect(img.querySelector("svg")).toBeNull();
  });
});
