import { describe, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { Toggle } from "./toggle";

function htmlControl(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

describe("Toggle focus ring", () => {
  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Toggle>Bold</Toggle>
      </>
    );
    await assertFocusRingAtBothDensities(htmlControl("Before"), htmlControl("Bold"));
  });
});
