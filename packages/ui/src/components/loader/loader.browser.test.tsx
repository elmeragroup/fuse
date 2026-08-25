import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Loader } from "./loader";

const SIZES = ["default", "small", "medium", "large", "xl"] as const;

const ICON_SIZE_CLASS = {
  default: "size-4",
  small: "size-3",
  medium: "size-6",
  large: "size-8",
  xl: "size-10",
} as const;

function statusElement(name?: string): HTMLElement {
  const locator = name === undefined ? page.getByRole("status") : page.getByRole("status", { name });
  const element = locator.element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(name === undefined ? "expected a status" : `expected a status named ${name}`);
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
  it("is found by role=status and named from a consumer aria-label", () => {
    renderThemed(<Loader aria-label="Laster" />);
    const loader = statusElement("Laster");
    expect(loader.tagName).toBe("DIV");
    expect(loader.getAttribute("data-slot")).toBe("loader");
    expect(loader.getAttribute("role")).toBe("status");
  });

  it("is found by role=status with no accessible name when aria-label is omitted", () => {
    renderThemed(<Loader />);
    const loader = statusElement();
    expect(loader.getAttribute("aria-label")).toBeNull();
    expect(page.getByRole("status", { name: "Loading" }).query()).toBeNull();
  });

  it("hides the spinning icon from the accessibility tree", () => {
    renderThemed(<Loader aria-label="Laster" />);
    const icon = statusIcon(statusElement("Laster"));
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect([...icon.classList]).toContain("animate-spin");
  });

  it("maps each size onto the icon class and merges className onto the wrapper", () => {
    for (const size of SIZES) {
      renderThemed(<Loader size={size} aria-label={size} className="bg-muted" />);
      const loader = statusElement(size);
      const classes = loader.className.split(/\s+/);
      expect(classes).toEqual(expect.arrayContaining(["flex", "items-center", "justify-center", "p-4"]));
      expect(classes).toContain("bg-muted");
      expect(classes).toContain("text-foreground");
      expect([...statusIcon(loader).classList]).toContain(ICON_SIZE_CLASS[size]);
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
