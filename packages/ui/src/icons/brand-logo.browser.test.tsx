import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "../../test/browser-render";
import { BRAND_CODES, BRANDS } from "../theme/tokens/themes";
import type { ThemeInput } from "../theme/tokens/themes";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders an accessible display-name fallback for elma full and mark", () => {
    render(
      <>
        <BrandLogo brand="elma" variant="full" />
        <BrandLogo brand="elma" variant="mark" title="Elmera mark" />
      </>
    );

    const full = page.getByRole("img", { name: "Elmera", exact: true }).element();
    const mark = page.getByRole("img", { name: "Elmera mark", exact: true }).element();
    expect(full.tagName).toBe("SPAN");
    expect(full.getAttribute("data-variant")).toBe("full");
    expect(full.textContent).toBe("Elmera");
    expect(mark.tagName).toBe("SPAN");
    expect(mark.getAttribute("data-variant")).toBe("mark");
    expect(mark.textContent).toBe("Elmera");
    expect(full.querySelector("svg")).toBeNull();
    expect(mark.querySelector("svg")).toBeNull();
  });

  it("uses an explicit title as the accessible name without inventing a mark", () => {
    render(<BrandLogo brand="elma" variant="mark" title="Elmera Group" />);
    const img = page.getByRole("img", { name: "Elmera Group", exact: true }).element();
    expect(img.textContent).toBe("Elmera");
    expect(img.querySelector("svg")).toBeNull();
    expect(img.querySelector("path")).toBeNull();
  });

  it("is exhaustive over every brand code and stamps data-variant", () => {
    expect(BRAND_CODES).toContain("elma");
    for (const brand of BRAND_CODES) {
      const { host, unmount } = render(<BrandLogo brand={brand} variant="full" />);
      const img = page.getByRole("img", { name: BRANDS[brand].displayName, exact: true }).element();
      expect(img.tagName).toBe("SPAN");
      expect(img.getAttribute("data-variant")).toBe("full");
      expect(img.getAttribute("role")).toBe("img");
      expect(img.getAttribute("aria-label")).toBe(BRANDS[brand].displayName);
      if (brand === "elma") {
        expect(img.textContent).toBe(BRANDS[brand].displayName);
        expect(host.querySelector("svg")).toBeNull();
      } else {
        expect(host.querySelector("svg")).not.toBeNull();
      }
      unmount();
    }
  });

  it("maps energy brands to their display names", () => {
    const cases = [
      ["fkas", "Fjordkraft"],
      ["fkab", "Fjordkraft Företag"],
      ["tkas", "TrøndelagKraft"],
      ["guen", "Gudbrandsdal Energi"],
      ["fkse", "Telinet"],
      ["elma", "Elmera"],
    ] as const;
    for (const [brand, name] of cases) {
      const { unmount } = render(<BrandLogo brand={brand} />);
      const img = page.getByRole("img", { name, exact: true }).element();
      if (brand === "elma") {
        expect(img.textContent).toBe(name);
        expect(img.querySelector("svg")).toBeNull();
      } else {
        expect(img.querySelector("svg")).not.toBeNull();
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
