import { createRef } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
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
  it("renders highlighted source whose accessible text equals the input code", () => {
    renderThemed(<Code code={SNIPPET} aria-label="Answer snippet" />);
    const region = codeRegion("Answer snippet");
    expect(region.tagName).toBe("PRE");
    expect(region.getAttribute("data-slot")).toBe("code");
    expect(region.textContent).toBe(SNIPPET);
    expect(region.querySelector("code")).not.toBeNull();
  });

  it("escapes HTML in the code string so the payload renders as text", () => {
    renderThemed(<Code code={XSS_PAYLOAD} aria-label="Unsafe payload" />);
    const region = codeRegion("Unsafe payload");
    expect(region.querySelector("img")).toBeNull();
    expect(region.textContent).toBe(XSS_PAYLOAD);
  });

  it("merges className onto the pre and forwards id and aria-label", () => {
    renderThemed(
      <Code code={SNIPPET} className="rounded-md bg-muted" id="answer" aria-label="Answer snippet" />
    );
    const region = codeRegion("Answer snippet");
    expect(region.id).toBe("answer");
    expect(getComputedStyle(region).overflow).toBe("auto");
    expect(getComputedStyle(region).fontFamily).not.toBe("");
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
});
