import { createRef } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { Skeleton } from "./skeleton";

function skeletonElement(): HTMLElement {
  // spec §9 slot audit: skeleton has no role; locate by the mandated data-slot.
  const element = document.querySelector('[data-slot="skeleton"]');
  if (!(element instanceof HTMLElement)) {
    throw new Error('expected an element with data-slot="skeleton"');
  }
  return element;
}

describe("Skeleton", () => {
  it("renders a div with data-slot=skeleton and no role", () => {
    renderThemed(<Skeleton className="h-4 w-24" />);
    const skeleton = skeletonElement();
    expect(skeleton.tagName).toBe("DIV");
    expect(skeleton.getAttribute("data-slot")).toBe("skeleton");
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.getAttribute("role")).toBeNull();
    expect(skeleton.getAttribute("tabindex")).toBeNull();
  });

  it("emits aria-hidden=true and is absent from the accessibility tree without a consumer wrap", () => {
    renderThemed(
      <div aria-busy="true">
        <Skeleton className="h-4 w-24" />
      </div>
    );
    const skeleton = skeletonElement();
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.parentElement?.getAttribute("aria-hidden")).toBeNull();
    expect(skeleton.closest("[aria-busy='true']")).not.toBeNull();
    skeleton.focus();
    expect(document.activeElement).not.toBe(skeleton);
  });

  it("lets a consumer aria-hidden on the spread override the default", () => {
    renderThemed(<Skeleton aria-hidden="false" className="h-4 w-24" />);
    expect(skeletonElement().getAttribute("aria-hidden")).toBe("false");
  });

  it("merges consumer sizing with the base classes and lets a bg-* override win", () => {
    renderThemed(<Skeleton className="h-4 w-full max-w-24 bg-primary" />);
    const skeleton = skeletonElement();
    expect(skeleton.getBoundingClientRect().height).toBe(16);
    expect(skeleton.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(getComputedStyle(skeleton).maxWidth).toBe("96px");
    expect(getComputedStyle(skeleton).backgroundColor).toBe(cssVarColor(skeleton, "--primary"));
  });

  it("forwards id, data-*, event handlers, and ref to the div", () => {
    const ref = createRef<HTMLDivElement>();
    let clicks = 0;
    renderThemed(
      <Skeleton
        ref={ref}
        id="invoice-placeholder"
        data-loading="row"
        className="h-4 w-24"
        onClick={() => {
          clicks += 1;
        }}
      />
    );
    const skeleton = skeletonElement();
    expect(ref.current).toBe(skeleton);
    expect(skeleton.id).toBe("invoice-placeholder");
    expect(skeleton.getAttribute("data-loading")).toBe("row");
    skeleton.click();
    expect(clicks).toBe(1);
  });
});
