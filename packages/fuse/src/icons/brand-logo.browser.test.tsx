import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "../../test/browser-render";
import { roleNamed } from "../../test/themed-browser-render";
import { BRAND_CODES, BRANDS } from "../theme/tokens/themes";
import type { BrandCode, ThemeInput } from "../theme/tokens/themes";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("uses an explicit title as the accessible name without inventing a mark", () => {
    render(<BrandLogo brand="elma" variant="mark" title="Elmera Group" />);
    const img = page.getByRole("img", { name: "Elmera Group", exact: true }).element();
    expect(img.textContent).toBe("Elmera");
    expect(img.querySelector("svg")).toBeNull();
    expect(img.querySelector("path")).toBeNull();
  });

  it("lets an explicit aria-label win over the title and the display name, and keeps the display name when aria-label is undefined", () => {
    const { unmount } = render(
      <>
        <BrandLogo brand="fkas" aria-label="Home" />
        <BrandLogo brand="elma" title="Elmera Group" aria-label="Group home" />
      </>
    );
    expect(roleNamed("img", "Home").getAttribute("data-variant")).toBe("full");
    expect(roleNamed("img", "Group home").textContent).toBe("Elmera");
    expect(page.getByRole("img", { name: "Fjordkraft", exact: true }).query()).toBeNull();
    expect(page.getByRole("img", { name: "Elmera Group", exact: true }).query()).toBeNull();
    unmount();

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

  it("paints every full logo's lettering in the inherited text colour and its mark in exactly the brand's colours", () => {
    // Oracle, measured by hand from the brand artwork: the fraction of the logo's width where the
    // lettering starts (the mark sits left of it), and every colour the mark paints, with a
    // gradient counted as its stop colours. TrøndelagKraft's lamp has a text-coloured ring and base
    // around its yellow light. Fjordkraft's mark is one ink with its lettering.
    const text = "rgb(1, 2, 3)";
    const artwork = {
      fkas: { letteringFrom: 0, markInks: [] },
      fkab: { letteringFrom: 0, markInks: [] },
      tkas: { letteringFrom: 0.14, markInks: [text, "rgb(252, 227, 0)"] },
      guen: { letteringFrom: 0.3, markInks: ["rgb(236, 100, 4)", "rgb(246, 179, 87)"] },
      fkse: { letteringFrom: 0.15, markInks: ["rgb(45, 192, 208)"] },
      ngfi: {
        letteringFrom: 0.48,
        markInks: [
          "rgb(99, 182, 123)",
          "rgb(115, 190, 226)",
          "rgb(167, 155, 175)",
          "rgb(243, 205, 32)",
          "rgb(250, 92, 95)",
        ],
      },
    } satisfies Record<Exclude<BrandCode, "elma">, { letteringFrom: number; markInks: readonly string[] }>;
    const drawn = BRAND_CODES.filter((code): code is Exclude<BrandCode, "elma"> => code !== "elma");
    for (const brand of drawn) {
      const { letteringFrom, markInks } = artwork[brand];
      const { host, unmount } = render(
        <div style={{ color: text, width: 1000 }}>
          <style>{"svg { display: block; width: 1000px; height: auto; }"}</style>
          <BrandLogo brand={brand} />
        </div>
      );
      const svg = host.querySelector("svg");
      if (svg === null) {
        throw new Error(`expected ${brand} to draw an SVG`);
      }
      const box = svg.getBoundingClientRect();
      const lettering: string[] = [];
      const mark = new Set<string>();
      for (const part of svg.querySelectorAll("path, polygon, rect")) {
        if (part.closest("defs, clipPath") !== null) continue;
        const rect = part.getBoundingClientRect();
        // Empty geometry paints nothing, whatever its fill says.
        if (rect.width === 0 || rect.height === 0) continue;
        const fill = getComputedStyle(part).fill;
        if ((rect.left - box.left) / box.width >= letteringFrom) {
          lettering.push(fill);
          continue;
        }
        const gradient = /^url\("#(?<id>[^"]+)"\)$/u.exec(fill)?.groups?.id;
        const stops = gradient === undefined ? [] : [...svg.querySelectorAll(`[id="${gradient}"] stop`)];
        if (gradient !== undefined && stops.length === 0) {
          throw new Error(`${brand}: ${fill} names no gradient in the logo`);
        }
        for (const ink of gradient === undefined
          ? [fill]
          : stops.map((stop) => getComputedStyle(stop).stopColor)) {
          mark.add(ink);
        }
      }
      expect(lettering.length, brand).toBeGreaterThan(0);
      expect(new Set(lettering), brand).toEqual(new Set([text]));
      expect(mark, brand).toEqual(new Set(markInks));
      unmount();
    }
  });

  it("paints every mark at least half of a 24px tile in both dimensions", () => {
    // Elmera has no mark artwork; the fallback tests above own its no-path contract.
    for (const brand of BRAND_CODES.filter((code) => code !== "elma")) {
      const { host, unmount } = render(
        <div style={{ width: 24, height: 24 }}>
          <style>{"svg { display: block; width: 24px; height: 24px; }"}</style>
          <BrandLogo brand={brand} variant="mark" />
        </div>
      );
      const paths = [...host.querySelectorAll("path")].map((path) => path.getBoundingClientRect());
      expect(paths.length, brand).toBeGreaterThan(0);
      const width =
        Math.max(...paths.map((rect) => rect.right)) - Math.min(...paths.map((rect) => rect.left));
      const height =
        Math.max(...paths.map((rect) => rect.bottom)) - Math.min(...paths.map((rect) => rect.top));
      // Oracle: half the tile, so a mark reads at icon size; a wordmark-wide viewBox paints about 2px tall.
      expect(width, brand).toBeGreaterThanOrEqual(12);
      expect(height, brand).toBeGreaterThanOrEqual(12);
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
