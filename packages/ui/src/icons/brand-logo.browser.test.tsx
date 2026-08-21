import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { BRAND_CODES, BRANDS } from "../theme/tokens/themes";
import { BrandLogo } from "./brand-logo";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

function render(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => {
    root.render(node);
  });
  let didUnmount = false;
  const unmount = () => {
    if (didUnmount) {
      return;
    }
    didUnmount = true;
    flushSync(() => {
      root.unmount();
    });
    host.remove();
  };
  cleanups.push(unmount);
  return { host, unmount };
}

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
      expect(img.textContent).toBe(BRANDS[brand].displayName);
      expect(host.querySelector("svg")).toBeNull();
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
      expect(page.getByRole("img", { name, exact: true }).element().textContent).toBe(name);
      unmount();
    }
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
