import { createRef } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { Skeleton } from "./skeleton";

function skeletonElement(): HTMLElement {
  // DOM audit: skeleton has no role; locate by the mandated data-slot.
  const element = document.querySelector('[data-slot="skeleton"]');
  if (!(element instanceof HTMLElement)) {
    throw new Error('expected an element with data-slot="skeleton"');
  }
  return element;
}

describe("Skeleton", () => {
  it("merges consumer sizing and a winning bg-*, and forwards aria-hidden, id, data-*, handlers and ref", () => {
    const ref = createRef<HTMLDivElement>();
    let clicks = 0;
    renderThemed(
      <Skeleton
        ref={ref}
        id="invoice-placeholder"
        data-loading="row"
        aria-hidden="false"
        className="h-4 w-full max-w-24 bg-primary"
        onClick={() => {
          clicks += 1;
        }}
      />
    );
    const skeleton = skeletonElement();
    expect(skeleton.getBoundingClientRect().height).toBe(16);
    expect(skeleton.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(getComputedStyle(skeleton).maxWidth).toBe("96px");
    expect(getComputedStyle(skeleton).backgroundColor).toBe(cssVarColor(skeleton, "--primary"));
    expect(skeleton.getAttribute("aria-hidden")).toBe("false");
    expect(ref.current).toBe(skeleton);
    expect(skeleton.id).toBe("invoice-placeholder");
    expect(skeleton.getAttribute("data-loading")).toBe("row");
    skeleton.click();
    expect(clicks).toBe(1);
  });
});
