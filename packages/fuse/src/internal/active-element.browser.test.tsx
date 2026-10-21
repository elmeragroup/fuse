import { describe, expect, it, onTestFinished } from "vitest";

import { deepActiveElement, hasFocus } from "./active-element";

/**
 * A button two shadow roots deep, the outer one open and the inner one `mode`, beside a button in
 * the outer root.
 */
function nested(mode: ShadowRootMode) {
  const host = document.createElement("div");
  document.body.append(host);
  onTestFinished(() => {
    host.remove();
  });
  const outer = host.attachShadow({ mode: "open" });
  const innerHost = document.createElement("div");
  const sibling = document.createElement("button");
  outer.append(innerHost, sibling);
  const inner = innerHost.attachShadow({ mode });
  const button = document.createElement("button");
  inner.append(button);
  return { host, outer, innerHost, sibling, button };
}

describe("deepActiveElement and hasFocus", () => {
  it("follow focus down through nested open shadow roots to the focused control", () => {
    const { host, innerHost, sibling, button } = nested("open");
    button.focus();
    expect(document.activeElement).toBe(host);
    expect(deepActiveElement(document)).toBe(button);
    expect(hasFocus(button)).toBe(true);
    expect(hasFocus(innerHost)).toBe(false);
    expect(hasFocus(sibling)).toBe(false);
  });

  it("read a control in a closed shadow root from its own root", () => {
    const { outer, innerHost, button } = nested("closed");
    button.focus();
    expect(deepActiveElement(outer)).toBe(innerHost);
    expect(hasFocus(button)).toBe(true);
  });

  it("report nothing in a root that focus is outside of", () => {
    const { outer } = nested("open");
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    onTestFinished(() => {
      elsewhere.remove();
    });
    elsewhere.focus();
    expect(deepActiveElement(outer)).toBeNull();
    expect(deepActiveElement(document)).toBe(elsewhere);
  });
});
