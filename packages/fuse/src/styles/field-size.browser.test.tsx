import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "../../dist/styles.css";
import { withLocale } from "../../test/locale-matrix";
import { atHostRoots, expectTargets } from "../../test/target-size";
import {
  CONTROL_MD,
  CONTROL_SM,
  FIXED_CONTROL_TYPE,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../test/themed-browser-render";
import { Autocomplete } from "../components/autocomplete";
import { Combobox } from "../components/combobox";
import { InputGroup } from "../components/input-group";
import { Input } from "../components/input/input";
import { NumberField } from "../components/number-field/number-field";
import { PhoneNumberField } from "../components/phone-number-field/phone-number-field";
import { Select } from "../components/select";
import { SelectField } from "../components/select-field/select-field";
import { TextField } from "../components/text-field/text-field";
import { TextareaField } from "../components/textarea-field/textarea-field";
import { Textarea } from "../components/textarea/textarea";
import { DateField } from "../react-aria/date-field/date-field";
import { DatePicker } from "../react-aria/date-picker/date-picker";
import { DateRangePicker } from "../react-aria/date-range-picker/date-range-picker";
import { SearchField } from "../react-aria/search-field/search-field";
import { UiProviders } from "../react-aria/ui-providers/ui-providers";
import { DENSITIES } from "../theme/density";
import type { Density } from "../theme/density";

/**
 * Field size: every text-entry field box at `size="default"` and `size="sm"`, at both densities.
 *
 * The oracle is `DENSITY_METRICS`, through the shared harness's `CONTROL_MD` and `CONTROL_SM`
 * tables: `"default"` is the md control size and `"sm"` the sm one. The sm type is Tailwind's
 * fixed `text-sm`, which the harness writes by hand in `FIXED_CONTROL_TYPE`.
 */

type FieldSizeName = "default" | "sm";

const SIZES = ["default", "sm"] as const satisfies readonly FieldSizeName[];

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

function expectedBox(size: FieldSizeName, density: Density) {
  return size === "sm"
    ? { height: CONTROL_SM[density].height, px: CONTROL_SM[density].px, font: FIXED_CONTROL_TYPE.sm.font }
    : { height: CONTROL_MD[density].height, px: CONTROL_MD[density].px, font: CONTROL_MD[density].font };
}

function parentOf(element: HTMLElement): HTMLElement {
  const parent = element.parentElement;
  if (parent === null) {
    throw new Error("expected a field box around the control");
  }
  return parent;
}

function firstSegmentIn(group: HTMLElement): HTMLElement {
  const segment = group.querySelector<HTMLElement>("[role='spinbutton']");
  if (segment === null) {
    throw new Error("expected a date segment in the field box");
  }
  return segment;
}

/** One field: how it renders at a size, where its box is and which element holds its text. */
type FieldProbe = {
  readonly field: string;
  /** `control` boxes are as tall as the control size; `content` boxes grow with their text. */
  readonly height: "control" | "content";
  readonly render: (name: string, size: FieldSizeName) => ReactNode;
  readonly box: (name: string) => HTMLElement;
  readonly text: (name: string) => HTMLElement;
};

const FIELDS: readonly FieldProbe[] = [
  {
    field: "Input",
    height: "control",
    render: (name, size) => <Input size={size} aria-label={name} />,
    box: (name) => roleNamed("textbox", name),
    text: (name) => roleNamed("textbox", name),
  },
  {
    field: "Textarea",
    height: "content",
    render: (name, size) => <Textarea size={size} aria-label={name} />,
    box: (name) => roleNamed("textbox", name),
    text: (name) => roleNamed("textbox", name),
  },
  {
    field: "TextField",
    height: "control",
    render: (name, size) => <TextField size={size} label={name} />,
    box: (name) => roleNamed("textbox", name),
    text: (name) => roleNamed("textbox", name),
  },
  {
    field: "TextareaField",
    height: "content",
    render: (name, size) => <TextareaField size={size} label={name} />,
    box: (name) => roleNamed("textbox", name),
    text: (name) => roleNamed("textbox", name),
  },
  {
    field: "SelectField",
    height: "control",
    render: (name, size) => (
      <SelectField size={size} label={name} placeholder="Pick">
        <Select.Item value="a">A</Select.Item>
      </SelectField>
    ),
    box: (name) => roleNamed("combobox", name),
    text: (name) => roleNamed("combobox", name),
  },
  {
    field: "NumberField",
    height: "control",
    render: (name, size) => <NumberField size={size} label={name} defaultValue={1} />,
    box: (name) => parentOf(roleNamed("textbox", name)),
    text: (name) => roleNamed("textbox", name),
  },
  {
    field: "PhoneNumberField",
    height: "control",
    render: (name, size) => <PhoneNumberField size={size} label={name} />,
    box: (name) => parentOf(roleNamed("textbox", name)),
    text: (name) => roleNamed("textbox", name),
  },
  {
    field: "SearchField",
    height: "control",
    render: (name, size) => <SearchField size={size} label={name} defaultValue="meter" />,
    box: (name) => parentOf(roleNamed("searchbox", name)),
    text: (name) => roleNamed("searchbox", name),
  },
  {
    field: "DateField",
    height: "control",
    render: (name, size) => <DateField size={size} label={name} />,
    box: (name) => roleNamed("group", name),
    text: (name) => firstSegmentIn(roleNamed("group", name)),
  },
  {
    field: "DatePicker",
    height: "control",
    render: (name, size) => <DatePicker size={size} label={name} />,
    box: (name) => roleNamed("group", name),
    text: (name) => firstSegmentIn(roleNamed("group", name)),
  },
  {
    field: "DateRangePicker",
    height: "control",
    render: (name, size) => <DateRangePicker size={size} label={name} />,
    box: (name) => roleNamed("group", name),
    text: (name) => firstSegmentIn(roleNamed("group", name)),
  },
  {
    field: "InputGroup",
    height: "control",
    render: (name, size) => (
      <InputGroup.Root size={size} aria-label={name}>
        <InputGroup.Input aria-label={`${name} input`} />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button size="icon-sm" aria-label={`${name} action`} />
        </InputGroup.Addon>
      </InputGroup.Root>
    ),
    box: (name) => roleNamed("group", name),
    text: (name) => roleNamed("textbox", `${name} input`),
  },
  {
    field: "InputGroup labelled button",
    height: "control",
    render: (name, size) => (
      <InputGroup.Root size={size} aria-label={name}>
        <InputGroup.Input aria-label={`${name} input`} />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button size="sm">Search</InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    ),
    box: (name) => roleNamed("group", name),
    text: (name) => roleNamed("textbox", `${name} input`),
  },
  {
    field: "Combobox.Input",
    height: "control",
    render: (name, size) => (
      <Combobox.Root items={["Apple"]}>
        <Combobox.Input size={size} aria-label={name} />
      </Combobox.Root>
    ),
    box: (name) => parentOf(roleNamed("combobox", name)),
    text: (name) => roleNamed("combobox", name),
  },
  {
    field: "Combobox.Chips",
    height: "control",
    render: (name, size) => (
      <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
        <Combobox.Chips size={size}>
          <Combobox.Chip removeLabel={`${name} remove`}>Apple</Combobox.Chip>
          <Combobox.ChipsInput aria-label={name} />
        </Combobox.Chips>
      </Combobox.Root>
    ),
    box: (name) => parentOf(roleNamed("combobox", name)),
    text: (name) => roleNamed("combobox", name),
  },
  {
    field: "Autocomplete.Input",
    height: "control",
    render: (name, size) => (
      <Autocomplete.Root items={["Apple"]}>
        <Autocomplete.Input size={size} aria-label={name} showClear />
      </Autocomplete.Root>
    ),
    box: (name) => parentOf(roleNamed("combobox", name)),
    text: (name) => roleNamed("combobox", name),
  },
];

function probeName(probe: FieldProbe, size: FieldSizeName): string {
  return `${probe.field} ${size}`;
}

function renderFields(children: ReactNode): void {
  renderThemed(
    withLocale(
      "en-US",
      <UiProviders locale="en-US" navigate={() => undefined}>
        {/* Wide enough that the range picker keeps its two dates on one row. */}
        <div className="w-[32rem]">{children}</div>
      </UiProviders>
    )
  );
}

/** Every rendered button inside the box, which must sit within the box's own rect. */
function expectButtonsInside(box: HTMLElement, label: string): void {
  const outer = box.getBoundingClientRect();
  for (const button of box.querySelectorAll<HTMLElement>("button, [role='button']")) {
    const inner = button.getBoundingClientRect();
    if (inner.width === 0 && inner.height === 0) {
      continue;
    }
    const name = `${label} button ${button.getAttribute("aria-label") ?? ""}`;
    expect(inner.top, `${name} top`).toBeGreaterThanOrEqual(outer.top);
    expect(inner.bottom, `${name} bottom`).toBeLessThanOrEqual(outer.bottom);
    expect(inner.left, `${name} left`).toBeGreaterThanOrEqual(outer.left);
    expect(inner.right, `${name} right`).toBeLessThanOrEqual(outer.right);
  }
}

describe("field size", () => {
  it.each(DENSITIES)("sizes every field box at default and sm at %s", (density) => {
    stampDensity(density);
    renderFields(
      FIELDS.flatMap((probe) =>
        SIZES.map((size) => (
          <div key={probeName(probe, size)}>{probe.render(probeName(probe, size), size)}</div>
        ))
      )
    );

    for (const probe of FIELDS) {
      for (const size of SIZES) {
        const name = probeName(probe, size);
        const label = `${density} ${name}`;
        const expected = expectedBox(size, density);
        const box = probe.box(name);
        expect(box.getAttribute("data-size"), `${label} data-size`).toBe(size);
        if (probe.height === "control") {
          expect(box.getBoundingClientRect().height, `${label} height`).toBe(expected.height);
        } else {
          expect(px(getComputedStyle(box).paddingInlineStart), `${label} inset`).toBe(expected.px);
        }
        expect(px(getComputedStyle(probe.text(name)).fontSize), `${label} font`).toBe(expected.font);
        expectButtonsInside(box, label);
      }
    }
  });

  it.each(DENSITIES)(
    "keeps a 24px target for every button inside every box under a 12px root at %s",
    (density) => {
      stampDensity(density);
      renderFields(
        FIELDS.flatMap((probe) =>
          SIZES.map((size) => (
            <div key={probeName(probe, size)}>{probe.render(probeName(probe, size), size)}</div>
          ))
        )
      );
      // A host root below 16px scales every rem metric down, and the 24px target floor is fixed.
      atHostRoots([12], () => {
        for (const probe of FIELDS) {
          for (const size of SIZES) {
            const name = probeName(probe, size);
            const box = probe.box(name);
            const buttons = [...box.querySelectorAll<HTMLElement>("button, [role='button']")].filter(
              (button) => {
                const rect = button.getBoundingClientRect();
                return rect.width > 0 || rect.height > 0;
              }
            );
            const label = `${density} 12px ${name}`;
            box.scrollIntoView({ block: "center" });
            const outer = box.getBoundingClientRect();
            for (const square of expectTargets(buttons, label)) {
              expect(square.top, `${label} square top`).toBeGreaterThanOrEqual(outer.top);
              expect(square.bottom, `${label} square bottom`).toBeLessThanOrEqual(outer.bottom);
            }
          }
        }
      });
    }
  );

  it.each(DENSITIES)("keeps a default box nested in an sm box at the md size at %s", (density) => {
    stampDensity(density);
    renderFields(
      <InputGroup.Root size="sm" aria-label="outer">
        <InputGroup.Addon>
          <Input aria-label="nested default" />
        </InputGroup.Addon>
        <InputGroup.Input aria-label="outer input" />
      </InputGroup.Root>
    );
    const md = expectedBox("default", density);
    const sm = expectedBox("sm", density);
    const nested = roleNamed("textbox", "nested default");
    expect(nested.getBoundingClientRect().height, `${density} nested height`).toBe(md.height);
    expect(px(getComputedStyle(nested).fontSize), `${density} nested font`).toBe(md.font);
    expect(px(getComputedStyle(nested).paddingInlineStart), `${density} nested inset`).toBe(md.px);
    // The group's own input reads the outer box's size.
    expect(px(getComputedStyle(roleNamed("textbox", "outer input")).fontSize), `${density} outer font`).toBe(
      sm.font
    );
  });

  it.each(DENSITIES)(
    "lets a consumer padding class replace the sm chips box's row padding at %s",
    (density) => {
      stampDensity(density);
      renderFields(
        <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
          <Combobox.Chips size="sm" className="py-3">
            <Combobox.Chip removeLabel="Remove padded Apple">Apple</Combobox.Chip>
            <Combobox.ChipsInput aria-label="padded chips" />
          </Combobox.Chips>
        </Combobox.Root>
      );
      // Tailwind's `py-3` is 0.75rem, 12px at the 16px root.
      const box = getComputedStyle(parentOf(roleNamed("combobox", "padded chips")));
      expect(px(box.paddingTop), `${density} padding top`).toBe(12);
      expect(px(box.paddingBottom), `${density} padding bottom`).toBe(12);
    }
  );

  it.each(DENSITIES)("keeps an inner button outside any field box at the sm square at %s", (density) => {
    stampDensity(density);
    renderFields(<InputGroup.Button size="icon-sm" aria-label="loose action" />);
    const button = roleNamed("button", "loose action").getBoundingClientRect();
    expect(button.height, `${density} loose height`).toBe(CONTROL_SM[density].height);
    expect(button.width, `${density} loose width`).toBe(CONTROL_SM[density].height);
  });
});
