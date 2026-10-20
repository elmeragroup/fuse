import { createRef } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { assertNoAxeViolations } from "../../../test/axe";
import { renderThemed } from "../../../test/themed-browser-render";
import { Code } from "./code";

const SNIPPET = "const answer = 42;";
const XSS_PAYLOAD = '<img onerror="alert(1)" src="x">';

function codeRegion(name: string): HTMLElement {
  const element = page.getByRole("region", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a region named ${name}`);
  }
  return element;
}

describe("Code", () => {
  it("escapes HTML in the code string so the payload renders as text", () => {
    renderThemed(<Code code={XSS_PAYLOAD} aria-label="Unsafe payload" />);
    const region = codeRegion("Unsafe payload");
    expect(region.querySelector("img")).toBeNull();
    expect(region.textContent).toBe(XSS_PAYLOAD);
  });

  it("exposes a focusable scroll region with role=region and tabIndex 0", () => {
    const ref = createRef<HTMLPreElement>();
    renderThemed(<Code ref={ref} code={SNIPPET} aria-label="Answer snippet" />);
    const region = codeRegion("Answer snippet");
    expect(ref.current).toBe(region);
    expect(region.getAttribute("role")).toBe("region");
    expect(region.tabIndex).toBe(0);
    region.focus();
    expect(document.activeElement).toBe(region);
  });

  it("takes the region role only with a name, and stays keyboard-scrollable without one", async () => {
    const { host } = renderThemed(
      <>
        <h3 id="snippet-heading">Labelled snippet</h3>
        <Code code={SNIPPET} aria-labelledby="snippet-heading" />
        <Code code="const unnamed = true;" />
      </>
    );
    expect(codeRegion("Labelled snippet").tabIndex).toBe(0);
    expect(page.getByRole("region").elements()).toHaveLength(1);
    // DOM audit: an unnamed block has no role to query by; it is the <pre> around its text.
    const unnamed = page.getByText("const unnamed = true;").element().closest("pre");
    expect(unnamed?.hasAttribute("role")).toBe(false);
    expect(unnamed?.tabIndex).toBe(0);
    await assertNoAxeViolations(host);
  });
});
