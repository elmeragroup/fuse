/**
 * Unit under test: DateInput's segments on an iPhone (WebKit as an iPhone 15). Oracle: React
 * Aria's `useDateSegment`, which makes every segment a `textbox` with no spinbutton value
 * attributes on iOS, since VoiceOver on iOS cannot focus a spinbutton, and keeps the label, the
 * description on the first segment, the numeric keyboard and the Next key.
 *
 * Playwright's iPhone emulation keeps WebKit's desktop `navigator.platform` ("MacIntel", no touch
 * points), which neither React Aria's `isIOS` nor DateInput's reads as iOS. A real iPhone's Safari
 * reports "iPhone", so every scenario first sets the platform the device reports.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import "../../temporal-polyfill";
import { DateField } from "./date-field";

beforeAll(() => {
  Object.defineProperty(navigator, "platform", { value: "iPhone", configurable: true });
});

afterAll(() => {
  // Drops the own property, so the prototype's getter answers again.
  Reflect.deleteProperty(navigator, "platform");
});

function Harness(): ReactElement {
  const [value, setValue] = useState("unchanged");
  return withLocale(
    "en-US",
    <>
      <DateField label="Start date" description="Weekdays only" onChange={(next) => setValue(String(next))} />
      <output aria-label="Committed value">{value}</output>
    </>
  );
}

describe("DateField on an iPhone", () => {
  it("makes each segment a named textbox without spinbutton values", () => {
    renderThemed(<Harness />);

    expect(page.getByRole("spinbutton").elements()).toHaveLength(0);
    for (const unit of ["month", "day", "year"]) {
      const segment = roleNamed("textbox", `${unit}, Start date`);
      for (const attribute of ["aria-valuenow", "aria-valuetext", "aria-valuemin", "aria-valuemax"]) {
        expect(segment).not.toHaveAttribute(attribute);
      }
      expect(segment).toHaveAttribute("inputmode", "numeric");
      expect(segment).toHaveAttribute("enterkeyhint", "next");
      expect(segment).toHaveAttribute("contenteditable", "true");
    }
    expect(roleNamed("textbox", "month, Start date")).toHaveAccessibleDescription("Weekdays only");
    expect(roleNamed("textbox", "day, Start date")).not.toHaveAttribute("aria-describedby");
  });

  it("commits a date typed into the textboxes", async () => {
    renderThemed(<Harness />);
    roleNamed("textbox", "month, Start date").focus();
    await userEvent.keyboard("10052026");

    await expect
      .element(page.getByRole("status", { name: "Committed value" }))
      .toHaveTextContent("2026-10-05");
  });
});
