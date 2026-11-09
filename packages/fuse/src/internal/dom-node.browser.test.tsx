import { describe, expect, it, onTestFinished } from "vitest";

import { hasFocus } from "./active-element";
import {
  containsAcrossShadowRoots,
  isElement,
  isFocusRoot,
  isHTMLElement,
  isNode,
  isText,
  windowOf,
} from "./dom-node";

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

  it("tell a frame's text nodes and elements apart, and find the frame's own window", () => {
    const frameDoc = frameDocument();
    const text = frameDoc.createTextNode("x");
    const paragraph = frameDoc.createElement("p");
    frameDoc.body.append(paragraph, text);

    // The premise: this window's constructors miss the frame's nodes.
    expect(text instanceof Text).toBe(false);
    expect(paragraph instanceof Element).toBe(false);
    expect([isText(text), isElement(text), isText(paragraph), isElement(paragraph)]).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(windowOf(paragraph)).toBe(frameDoc.defaultView);
    expect(windowOf(frameDoc)).toBe(frameDoc.defaultView);
    expect(windowOf(paragraph)).not.toBe(window);
    expect(windowOf(document.body)).toBe(window);
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

describe("containsAcrossShadowRoots", () => {
  it("finds a node through nested shadow roots, open and closed, and nowhere else", () => {
    // outer > host > (open shadow) inner host > (closed shadow) field, and a sibling beside outer.
    const outer = document.createElement("div");
    const sibling = document.createElement("div");
    const host = document.createElement("div");
    outer.append(host);
    document.body.append(outer, sibling);
    onTestFinished(() => {
      outer.remove();
      sibling.remove();
    });
    const innerHost = document.createElement("span");
    host.attachShadow({ mode: "open" }).append(innerHost);
    const field = document.createElement("input");
    innerHost.attachShadow({ mode: "closed" }).append(field);

    // The premise: a plain `contains` stops at the first shadow root.
    expect(outer.contains(field)).toBe(false);
    expect(containsAcrossShadowRoots(outer, field)).toBe(true);
    expect(containsAcrossShadowRoots(host, field)).toBe(true);
    expect(containsAcrossShadowRoots(innerHost, field)).toBe(true);
    expect(containsAcrossShadowRoots(outer, outer)).toBe(true);
    expect(containsAcrossShadowRoots(sibling, field)).toBe(false);
    expect(containsAcrossShadowRoots(field, outer)).toBe(false);
  });
});
