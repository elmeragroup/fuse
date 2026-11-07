import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { Orders, STATUS_THREE } from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { fkasBranded, fkasPrivate } from "../../../test/theme-fixtures";
import {
  px,
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { DatePickerPresetGroup, DatePickerPresetItem } from "../../react-aria/date-picker/date-picker";
import type { Density } from "../../theme/density";
import { ThemeScope } from "../../theme/theme-scope";
import { ButtonGroup } from "../button-group";
import { Button } from "./button";

/** The inline padding of an element's start and end edges, in px. */
function paddingOf(element: Element) {
  const style = getComputedStyle(element);
  return { start: px(style.paddingLeft), end: px(style.paddingRight) };
}

/** The inline padding of a control's start and end edges, in px. */
function inlinePadding(name: string, role: "button" | "combobox" = "button") {
  return paddingOf(roleNamed(role, name));
}

/** The box of a preset, the label that wraps its visually hidden radio input. */
function presetBox(name: string): Element {
  const label = roleNamed("radio", name).closest("label");
  if (label === null) {
    throw new Error(`expected the ${name} preset's label`);
  }
  return label;
}

function Icon() {
  return (
    <svg data-icon="inline-start" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
    </svg>
  );
}

describe("Button label floor", () => {
  let restoreDocumentTheme: () => void = () => undefined;

  // `themed-browser-render` clears `data-density` after every test.
  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
    document.documentElement.style.fontSize = "16px";
  });

  afterEach(() => {
    restoreDocumentTheme();
    document.documentElement.style.removeProperty("font-size");
  });

  // Oracle: the padding policy in px at the 16px root. Dense label padding is 8px at xs and
  // 10px from sm up, and comfortable md is 32px. A branded button floors its label edges at
  // 12px, so only branded dense labels move; icon edges and grouped buttons keep their inset.
  it.each([
    ["branded dense md", fkasBranded, "dense", "default", 12],
    ["branded dense xs", fkasBranded, "dense", "xs", 12],
    ["branded dense sm", fkasBranded, "dense", "sm", 12],
    ["branded dense lg", fkasBranded, "dense", "lg", 12],
    ["neutral dense md", fkasPrivate, "dense", "default", 10],
    ["neutral dense xs", fkasPrivate, "dense", "xs", 8],
    ["branded comfortable md", fkasBranded, "comfortable", "default", 32],
    ["branded comfortable xs", fkasBranded, "comfortable", "xs", 12],
    ["neutral comfortable md", fkasPrivate, "comfortable", "default", 32],
  ] as const)("pads a %s label at %ipx", (name, theme, density: Density, size, expected) => {
    stampDensity(density);
    stampDocumentTheme(theme, "light");
    render(<Button size={size}>{name}</Button>);
    expect(inlinePadding(name)).toEqual({ start: expected, end: expected });
  });

  it("keeps the icon edge's inset and floors only the label edge", () => {
    stampDensity("dense");
    stampDocumentTheme(fkasBranded, "light");
    render(
      <Button>
        <Icon />
        Leading icon
      </Button>
    );
    // The md icon edge is 8px dense; the label edge takes the 12px floor.
    expect(inlinePadding("Leading icon")).toEqual({ start: 8, end: 12 });
  });

  it("keeps a ButtonGroup member at the density inset, also when it is itself a branded theme element", () => {
    // The second member is a branded ThemeScope rendered as the Button, so the unlayered theme
    // rule declares the 12px floor on the grouped button itself.
    stampDensity("dense");
    stampDocumentTheme(fkasBranded, "light");
    render(
      <ButtonGroup.Root>
        <Button variant="outline">Grouped</Button>
        <ThemeScope theme={fkasBranded} render={<Button variant="outline" />}>
          Themed member
        </ThemeScope>
      </ButtonGroup.Root>
    );
    expect(inlinePadding("Grouped")).toEqual({ start: 10, end: 10 });
    expect(inlinePadding("Themed member")).toEqual({ start: 10, end: 10 });
  });

  it("drops the floor in a neutral scope inside a branded page, in both schemes", () => {
    stampDensity("dense");
    for (const scheme of ["light", "dark"] as const) {
      stampDocumentTheme(fkasBranded, scheme);
      const { unmount } = render(
        <>
          <Button>Branded page</Button>
          <ThemeScope theme={fkasPrivate}>
            <Button>Neutral scope</Button>
          </ThemeScope>
        </>
      );
      expect(inlinePadding("Branded page"), scheme).toEqual({ start: 12, end: 12 });
      expect(inlinePadding("Neutral scope"), scheme).toEqual({ start: 10, end: 10 });
      unmount();
    }
  });

  it("gives a branded scope inside a neutral page the floor", () => {
    stampDensity("dense");
    stampDocumentTheme(fkasPrivate, "light");
    render(
      <ThemeScope theme={fkasBranded}>
        <Button>Branded scope</Button>
      </ThemeScope>
    );
    expect(inlinePadding("Branded scope")).toEqual({ start: 12, end: 12 });
  });

  it("keeps the dense inset on Fuse parts that replace Button's corner", () => {
    // Oracle: dense `--control-px-button-sm` is 10px at the 16px root. A DataTableFilter segment
    // squares Button and a date-picker preset rounds with the inner corner, so neither rounds as
    // the branded pill the floor is for.
    stampDensity("dense");
    stampDocumentTheme(fkasBranded, "light");
    render(
      withLocale(
        "en-US",
        <>
          <Orders initial={STATUS_THREE} />
          <DatePickerPresetGroup aria-label="Presets">
            <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
          </DatePickerPresetGroup>
        </>
      )
    );
    expect(inlinePadding("Status operator", "combobox")).toEqual({ start: 10, end: 10 });
    expect(paddingOf(presetBox("Today"))).toEqual({ start: 10, end: 10 });
  });
});
