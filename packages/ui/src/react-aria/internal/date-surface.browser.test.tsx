import { CalendarDate } from "@internationalized/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectFocusRing, expectNoFocusRing } from "../../../test/assert-focus-ring";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { DateField } from "../date-field/date-field";
import { DatePicker } from "../date-picker/date-picker";
import { DateRangePicker } from "../date-range-picker/date-range-picker";
import { UiProviders } from "../ui-providers/ui-providers";

const date = new CalendarDate(2026, 7, 14);
afterEach(() => document.documentElement.removeAttribute("data-density"));

describe("date field surface ownership", () => {
  for (const kind of ["field", "picker", "range"] as const) {
    for (const density of ["dense", "comfortable"] as const) {
      it(`${kind} has one border and keyboard ring at ${density} density`, async () => {
        document.documentElement.setAttribute("data-density", density);
        const onChange = vi.fn();
        const { host } = renderThemed(
          <UiProviders locale="en-US" navigate={() => undefined}>
            <button>Before</button>
            <div style={{ width: 480 }}>
              {kind === "field" ? (
                <DateField label="Date" defaultValue={date} onChange={onChange} />
              ) : kind === "picker" ? (
                <DatePicker label="Date" defaultValue={date} onChange={onChange} />
              ) : (
                <DateRangePicker
                  label="Date"
                  defaultValue={{ start: date, end: date.add({ days: 7 }) }}
                  onChange={onChange}
                />
              )}
            </div>
          </UiProviders>
        );
        await userEvent.click(page.getByRole("button", { name: "Before" }));
        await userEvent.keyboard("{Tab}");
        const segments = Array.from(host.querySelectorAll('[role="spinbutton"]'));
        const rows = Array.from(new Set(segments.map((element) => element.parentElement)));
        const surface = kind === "field" ? rows[0] : host.querySelector('[data-slot="field-group"]');
        if (!(surface instanceof HTMLElement)) throw new Error("Missing field surface");
        expect(surface.getBoundingClientRect().height).toBe(density === "dense" ? 36 : 44);
        expect(getComputedStyle(surface).borderTopWidth).toBe("1px");
        expectFocusRing(surface, "the field surface owns the keyboard ring");
        if (kind !== "field") {
          for (const row of rows) {
            if (!(row instanceof HTMLElement)) throw new Error("Missing segment row");
            const style = getComputedStyle(row);
            expect(style.borderTopWidth).toBe("0px");
            expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
            expect(style.boxShadow).toBe("none");
            expectNoFocusRing(row, "nested segment row has no second ring");
            expect(row.getBoundingClientRect().height).toBeLessThanOrEqual(
              surface.getBoundingClientRect().height - 2
            );
          }
        }
        await userEvent.keyboard("{ArrowUp}");
        expect(onChange).toHaveBeenCalled();
        if (kind === "range") {
          const separator = Array.from(surface.querySelectorAll('span[aria-hidden="true"]')).find(
            (element) => element.textContent === "–"
          );
          if (!(separator instanceof HTMLElement) || rows.length !== 2)
            throw new Error("Missing range layout");
          expect(rows[0]?.getBoundingClientRect().right).toBeLessThanOrEqual(
            separator.getBoundingClientRect().left
          );
          expect(separator.getBoundingClientRect().right).toBeLessThanOrEqual(
            rows[1]?.getBoundingClientRect().left ?? 0
          );
        }
        if (kind !== "field") {
          await userEvent.click(page.getByRole("button", { name: /^calendar/i }));
          await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
          await userEvent.keyboard("{Escape}");
          await expect.element(page.getByRole("dialog", { name: /calendar/i })).not.toBeInTheDocument();
        }
      });
    }

    it(`${kind} preserves disabled and invalid treatment`, () => {
      const { host } = renderThemed(
        <UiProviders locale="en-US" navigate={() => undefined}>
          {kind === "field" ? (
            <DateField label="Date" defaultValue={date} isDisabled isInvalid />
          ) : kind === "picker" ? (
            <DatePicker label="Date" defaultValue={date} isDisabled isInvalid />
          ) : (
            <DateRangePicker label="Date" defaultValue={{ start: date, end: date }} isDisabled isInvalid />
          )}
        </UiProviders>
      );
      const segment = host.querySelector('[role="spinbutton"]');
      const surface =
        kind === "field" ? segment?.parentElement : host.querySelector('[data-slot="field-group"]');
      if (!(surface instanceof HTMLElement)) throw new Error("Missing field surface");
      expect(getComputedStyle(surface).opacity).toBe("0.5");
      expect(getComputedStyle(surface).borderTopColor).toBe(cssVarColor(surface, "--error"));
      for (const element of host.querySelectorAll('[role="spinbutton"]'))
        expect(element instanceof HTMLElement && element.tabIndex < 0).toBe(true);
      if (kind !== "field") expect(page.getByRole("button", { name: /^calendar/i }).element()).toBeDisabled();
    });
  }
});
