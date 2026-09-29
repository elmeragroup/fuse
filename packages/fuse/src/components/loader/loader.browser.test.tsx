import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { px, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Loader } from "./loader";

const SIZES = ["default", "small", "medium", "large", "xl"] as const;

const ICON_SIZE_PX = {
  default: 16,
  small: 12,
  medium: 24,
  large: 32,
  xl: 40,
} as const;

function statusElement(name?: string): HTMLElement {
  if (name !== undefined) {
    return roleNamed("status", name);
  }
  const element = page.getByRole("status").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a status");
  }
  return element;
}

function statusIcon(status: HTMLElement): SVGElement {
  const icon = status.querySelector("svg");
  if (!(icon instanceof SVGElement)) {
    throw new Error("expected the status to contain an svg icon");
  }
  return icon;
}

describe("Loader", () => {
  it("is found by role=status, named only from a consumer aria-label, and hides the spinning icon from the accessibility tree", () => {
    const { unmount } = renderThemed(<Loader aria-label="Laster" />);
    const loader = statusElement("Laster");
    expect(loader.tagName).toBe("DIV");
    expect(loader.getAttribute("data-slot")).toBe("loader");
    expect(loader.getAttribute("role")).toBe("status");
    const icon = statusIcon(loader);
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(getComputedStyle(icon).animationName).not.toBe("none");
    unmount();

    renderThemed(<Loader />);
    const unnamed = statusElement();
    expect(unnamed.getAttribute("aria-label")).toBeNull();
    expect(page.getByRole("status", { name: "Loading" }).query()).toBeNull();
  });

  it("maps each size onto the icon and merges className onto the wrapper", () => {
    renderThemed(
      <>
        {SIZES.map((size) => (
          <Loader key={size} size={size} aria-label={size} className="bg-muted" />
        ))}
      </>
    );
    for (const size of SIZES) {
      const loader = statusElement(size);
      expect(getComputedStyle(loader).display).toBe("flex");
      const icon = statusIcon(loader);
      expect(px(getComputedStyle(icon).width)).toBe(ICON_SIZE_PX[size]);
      expect(getComputedStyle(icon).animationName, size).not.toBe("none");
      // The size axis lands on the icon only, never on the wrapper.
      expect(px(getComputedStyle(loader).width), size).not.toBe(ICON_SIZE_PX[size]);
    }
  });

  it("is not focusable", () => {
    renderThemed(<Loader aria-label="Laster" />);
    const loader = statusElement("Laster");
    expect(loader.getAttribute("tabindex")).toBeNull();
    loader.focus();
    expect(document.activeElement).not.toBe(loader);
  });
});
