import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Separator } from "./separator";

function separatorNamed(): HTMLElement {
  const element = page.getByRole("separator").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a separator");
  }
  return element;
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
});
