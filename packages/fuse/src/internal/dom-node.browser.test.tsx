import { describe, expect, it, onTestFinished } from "vitest";

import { hasFocus } from "./active-element";
import { isFocusRoot, isHTMLElement, isNode } from "./dom-node";

/** A same-origin frame's document, whose nodes belong to the frame's realm. */
function frameDocument(): Document {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  onTestFinished(() => {
    frame.remove();
  });
  const frameDoc = frame.contentDocument;
  if (frameDoc === null) {
    throw new Error("expected a same-origin frame document");
  }
  return frameDoc;
}

describe("realm-independent DOM checks", () => {
  it("recognise nodes, HTML elements and focus roots from another realm", () => {
    const frameDoc = frameDocument();
    const button = frameDoc.createElement("button");
    const host = frameDoc.createElement("div");
    frameDoc.body.append(button, host);
    const shadow = host.attachShadow({ mode: "open" });

    // The premise: this window's constructors miss the frame's nodes.
    expect(button instanceof HTMLElement).toBe(false);
    expect(isNode(button)).toBe(true);
    expect(isHTMLElement(button)).toBe(true);
    expect(isFocusRoot(frameDoc)).toBe(true);
    expect(isFocusRoot(shadow)).toBe(true);

    button.focus();
    expect(frameDoc.activeElement).toBe(button);
    expect(hasFocus(button)).toBe(true);
  });

  it("reject what is not a node, an HTML element or a focus root", () => {
    const frameDoc = frameDocument();
    const text = frameDoc.createTextNode("x");
    const svg = frameDoc.createElementNS("http://www.w3.org/2000/svg", "svg");
    expect(isNode(window)).toBe(false);
    expect(isNode(null)).toBe(false);
    expect(isHTMLElement(text)).toBe(false);
    expect(isHTMLElement(svg)).toBe(false);
    expect(isFocusRoot(frameDoc.createDocumentFragment())).toBe(false);
    expect(isFocusRoot(frameDoc.body)).toBe(false);
  });
});
