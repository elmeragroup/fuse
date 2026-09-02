import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useIsMobile } from "./use-is-mobile";

function Probe() {
  return String(useIsMobile());
}

describe("useIsMobile", () => {
  it("reports false during SSR without touching matchMedia", () => {
    expect("window" in globalThis).toBe(false);
    expect(renderToString(createElement(Probe))).toBe("false");
  });
});
