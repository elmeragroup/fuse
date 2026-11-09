/**
 * Unit under test: where a tap puts focus in DateInput, through real taps on Playwright's
 * touchscreen in Chromium. Oracle: React Aria's `useDatePickerGroup`: a tap on a segment focuses
 * that segment, and a tap on the field box beside the segments focuses the last segment before the
 * tap that is not a placeholder.
 */
import { describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import "../../../test/pointer-press";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { tapCenter } from "../../../test/touch-emulation";
import "../../temporal-polyfill";
import { DateField } from "./date-field";

describe("DateField taps", () => {
  it("focuses the segment a tap lands on", async () => {
    renderThemed(withLocale("en-US", <DateField label="Start date" defaultValue="2026-10-05" />));

    await tapCenter(roleNamed("spinbutton", "day, Start date"));
    await expect
      .element(page.getByRole("spinbutton", { name: "day, Start date", exact: true }))
      .toHaveFocus();
    await tapCenter(roleNamed("spinbutton", "year, Start date"));
    await expect
      .element(page.getByRole("spinbutton", { name: "year, Start date", exact: true }))
      .toHaveFocus();
  });

  it("focuses the last filled segment for a tap on the box after the segments", async () => {
    renderThemed(withLocale("en-US", <DateField label="Start date" defaultValue="2026-10-05" />));
    const box = roleNamed("group", "Start date").getBoundingClientRect();

    await commands.tap(box.right - 4, box.top + box.height / 2);
    await expect
      .element(page.getByRole("spinbutton", { name: "year, Start date", exact: true }))
      .toHaveFocus();
  });
});
