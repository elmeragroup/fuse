import type { ComponentProps } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { Separator } from "./separator";

function separatorNamed(): HTMLElement {
  const element = page.getByRole("separator").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a separator");
  }
  return element;
}

function Wrapper({ dataSlot, ...props }: ComponentProps<typeof Separator> & { dataSlot: string }) {
  return <Separator data-slot={dataSlot} {...props} />;
}

describe("Separator", () => {
  it.each([
    { orientation: undefined, expected: "horizontal" },
    { orientation: "vertical", expected: "vertical" },
  ] as const)(
    "emits $expected orientation (prop: $orientation) on the role and data attribute, with data-slot",
    ({ orientation, expected }) => {
      renderThemed(<Separator orientation={orientation} />);
      const separator = separatorNamed();
      expect(separator.getAttribute("data-slot")).toBe("separator");
      expect(separator.getAttribute("data-orientation")).toBe(expected);
      expect(separator.getAttribute("aria-orientation")).toBe(expected);
    }
  );

  it("lets a wrapper override data-slot via later-spread props", () => {
    renderThemed(<Wrapper dataSlot="custom" />);
    const separator = separatorNamed();
    expect(separator.getAttribute("data-slot")).toBe("custom");
  });

  it("lets a consumer className override the border fill via cn", () => {
    renderThemed(<Separator className="bg-primary" />);
    const separator = separatorNamed();
    expect(getComputedStyle(separator).backgroundColor).toBe(cssVarColor(separator, "--primary"));
  });

  it("stretches to a non-zero height in a flex row with no explicit height", () => {
    renderThemed(
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span>Docs</span>
        <Separator orientation="vertical" />
        <span>Source</span>
      </div>
    );
    const separator = separatorNamed();
    expect(separator.getBoundingClientRect().height).toBeGreaterThan(0);
  });
});
