import type { ReactElement } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { withLocale } from "../../test/locale-matrix";
import { fkasExternal, fkasPrivate, tkasCompany } from "../../test/theme-fixtures";
import {
  px,
  roleNamed,
  snapshotDocumentTheme,
  stampDocumentTheme,
  textNamed,
} from "../../test/themed-browser-render";
import { Badge } from "../components/badge/badge";
import { ButtonGroup } from "../components/button-group/button-group";
import { Button } from "../components/button/button";
import { Card } from "../components/card/card";
import { Checkbox } from "../components/checkbox/checkbox";
import { Combobox } from "../components/combobox/combobox";
import { Frame } from "../components/frame/frame";
import { InputGroup } from "../components/input-group/input-group";
import { Input } from "../components/input/input";
import { PhoneNumberField } from "../components/phone-number-field/phone-number-field";
import { Tabs } from "../components/tabs/tabs";
import { Toggle } from "../components/toggle/toggle";
import { Calendar } from "../react-aria/calendar/calendar";
import {
  DatePicker,
  DatePickerPresetGroup,
  DatePickerPresetItem,
} from "../react-aria/date-picker/date-picker";
import { SearchField } from "../react-aria/search-field/search-field";
import { UiProviders } from "../react-aria/ui-providers/ui-providers";
import { ThemeScope } from "./theme-scope";
import { themeSlug } from "./tokens/themes";
import type { ThemeInput } from "./tokens/themes";

const BUTTON_SIZES = ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] as const;

const guenExternal = { variant: "external", brand: "guen", segment: "private" } as const satisfies ThemeInput;

type Specimen =
  | "button"
  | "grouped button"
  | "card"
  | "input"
  | "badge"
  | "toggle"
  | "toggle xs"
  | "checkbox"
  | "input group"
  | "kbd"
  | "addon xs"
  | "addon sm"
  | "frame"
  | "calendar"
  | "calendar nav"
  | "tab"
  | "phone trigger"
  | "search clear"
  | "date trigger"
  | "preset"
  | "chip remove";

type Variant = "internal" | "fkas" | "tkas" | "guen";

/**
 * Corner radii in px. External themes change only their standalone buttons, so the external
 * values outside `button` and `calendar nav` are the ones Chromium measured on origin/main
 * (e178f6d7) with each theme on the document. Buttons inside a field box, a button group or
 * a preset list keep the radius they had there. The standalone button values and the
 * internal row come from the palette literals. Internal rounds every element with
 * `--radius`, 0.375rem (6px). An external button rounds with the brand's `--radius-button`,
 * which is 1.8125rem (29px) for fkas, 0.95rem (15.2px) for tkas and 0.5rem (8px) for guen.
 */
const EXPECTED = {
  internal: {
    button: 6,
    "grouped button": 6,
    card: 6,
    input: 6,
    badge: 6,
    toggle: 6,
    "toggle xs": 6,
    checkbox: 6,
    "input group": 6,
    kbd: 6,
    "addon xs": 6,
    "addon sm": 6,
    frame: 6,
    calendar: 6,
    "calendar nav": 6,
    tab: 6,
    "phone trigger": 6,
    "search clear": 6,
    "date trigger": 6,
    preset: 6,
    "chip remove": 6,
  },
  fkas: {
    button: 29,
    "grouped button": 10,
    card: 12,
    input: 10,
    badge: 12,
    toggle: 10,
    "toggle xs": 10,
    checkbox: 4,
    "input group": 10,
    kbd: 7,
    "addon xs": 7,
    "addon sm": 10,
    frame: 16,
    calendar: 4,
    "calendar nav": 29,
    tab: 10,
    "phone trigger": 4,
    "search clear": 10,
    "date trigger": 10,
    preset: 10,
    "chip remove": 10,
  },
  tkas: {
    button: 15.2,
    "grouped button": 13.2,
    card: 15.2,
    input: 13.2,
    badge: 15.2,
    toggle: 13.2,
    "toggle xs": 10,
    checkbox: 4,
    "input group": 13.2,
    kbd: 10.2,
    "addon xs": 10.2,
    "addon sm": 13.2,
    frame: 19.2,
    calendar: 4,
    "calendar nav": 15.2,
    tab: 13.2,
    "phone trigger": 4,
    "search clear": 13.2,
    "date trigger": 10,
    preset: 10,
    "chip remove": 10,
  },
  guen: {
    button: 8,
    "grouped button": 6,
    card: 8,
    input: 6,
    badge: 8,
    toggle: 6,
    "toggle xs": 6,
    checkbox: 4,
    "input group": 6,
    kbd: 3,
    "addon xs": 3,
    "addon sm": 6,
    frame: 12,
    calendar: 4,
    "calendar nav": 8,
    tab: 6,
    "phone trigger": 4,
    "search clear": 6,
    "date trigger": 6,
    preset: 6,
    "chip remove": 6,
  },
} as const satisfies Record<Variant, Record<Specimen, number>>;

function Specimens(): ReactElement {
  return withLocale(
    "en-US",
    <UiProviders locale="en-US" navigate={() => undefined}>
      {BUTTON_SIZES.map((size) => (
        <Button key={size} size={size} aria-label={`Button ${size}`} />
      ))}
      {/* The measured corner is the top-left one, so each grouped size leads its own group. */}
      <ButtonGroup.Root>
        <Button aria-label="Grouped default" />
        <Button aria-label="Grouped default end" />
      </ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button size="xs" aria-label="Grouped xs" />
        <Button size="xs" aria-label="Grouped xs end" />
      </ButtonGroup.Root>
      <Card.Root role="group" aria-label="Card" />
      <Input aria-label="Input" />
      <Badge>Badge</Badge>
      <Toggle>Toggle</Toggle>
      <Toggle size="xs">Toggle xs</Toggle>
      <Checkbox aria-label="Checkbox" />
      <InputGroup.Root aria-label="Input group">
        <InputGroup.Input aria-label="Grouped input" />
        <InputGroup.Addon align="inline-end">
          <kbd>K</kbd>
        </InputGroup.Addon>
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button size="xs">Addon xs</InputGroup.Button>
          <InputGroup.Button size="sm">Addon sm</InputGroup.Button>
          <InputGroup.Button size="icon-xs" aria-label="Addon icon-xs" />
          <InputGroup.Button size="icon-sm" aria-label="Addon icon-sm" />
        </InputGroup.Addon>
      </InputGroup.Root>
      <Frame.Root role="group" aria-label="Frame" />
      <Calendar aria-label="Calendar" />
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">Tab</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      <PhoneNumberField label="Phone" />
      <SearchField label="Meter search" defaultValue="7359" />
      <DatePicker label="Start" />
      <DatePickerPresetGroup>
        <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
      </DatePickerPresetGroup>
      <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
        <Combobox.Chips aria-label="Selected fruit">
          <Combobox.Chip removeLabel="Remove Apple">Apple</Combobox.Chip>
          <Combobox.ChipsInput aria-label="Fruit" />
        </Combobox.Chips>
      </Combobox.Root>
    </UiProviders>
  );
}

/** The one calendar root. React Aria appends the visible month to its accessible name. */
function calendarRoot(): HTMLElement {
  const element = page.getByRole("application", { name: /^Calendar/ }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the calendar application root");
  }
  return element;
}

/** The date picker's calendar trigger. React Aria names it "Calendar" plus the field label. */
function dateTrigger(): HTMLElement {
  const element = page.getByRole("button", { name: /^Calendar.*Start/ }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the date picker trigger");
  }
  return element;
}

/**
 * One of the calendar's own month buttons. React Aria also renders an unstyled, hidden
 * button of the same name after the grid, so the query takes the first match, the header
 * button.
 */
function calendarNav(name: "Previous" | "Next"): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).first().element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected the calendar's ${name} button`);
  }
  return element;
}

/** A preset item's label, the element that carries the preset's button chrome. */
function presetNamed(name: string): HTMLElement {
  const label = roleNamed("radio", name).closest("label");
  if (!(label instanceof HTMLElement)) {
    throw new Error(`expected the preset label for ${name}`);
  }
  return label;
}

function radius(element: HTMLElement): number {
  return px(getComputedStyle(element).borderTopLeftRadius);
}

/** Every specimen's top-left corner radius, keyed by the element it stands for. */
function measure(): readonly (readonly [Specimen, string, number])[] {
  const button = (specimen: Specimen, name: string) =>
    [specimen, name, radius(roleNamed("button", name))] as const;
  return [
    ...BUTTON_SIZES.map((size) => button("button", `Button ${size}`)),
    button("grouped button", "Grouped default"),
    button("grouped button", "Grouped xs"),
    ["card", "Card", radius(roleNamed("group", "Card"))],
    ["input", "Input", radius(roleNamed("textbox", "Input"))],
    ["badge", "Badge", radius(textNamed("Badge"))],
    button("toggle", "Toggle"),
    button("toggle xs", "Toggle xs"),
    ["checkbox", "Checkbox", radius(roleNamed("checkbox", "Checkbox"))],
    ["input group", "Input group", radius(roleNamed("group", "Input group"))],
    ["kbd", "Kbd", radius(textNamed("K"))],
    button("addon xs", "Addon xs"),
    button("addon xs", "Addon icon-xs"),
    button("addon sm", "Addon sm"),
    button("addon sm", "Addon icon-sm"),
    ["frame", "Frame", radius(roleNamed("group", "Frame"))],
    ["calendar", "Calendar", radius(calendarRoot())],
    ["calendar nav", "Previous", radius(calendarNav("Previous"))],
    ["calendar nav", "Next", radius(calendarNav("Next"))],
    ["tab", "Tab", radius(roleNamed("tab", "Tab"))],
    button("phone trigger", "Select country"),
    button("search clear", "Clear search"),
    ["date trigger", "Date trigger", radius(dateTrigger())],
    ["preset", "Today", radius(presetNamed("Today"))],
    button("chip remove", "Remove Apple"),
  ];
}

function expectRadii(variant: Variant, context: string): void {
  for (const [specimen, name, measured] of measure()) {
    expect(measured, `${context} ${name}`).toBeCloseTo(EXPECTED[variant][specimen], 1);
  }
}

const CASES: readonly (readonly [Variant, ThemeInput, ThemeInput])[] = [
  // Each case names the theme under test and a document theme with different radii, so a
  // value resolved against the document root instead of the scope shows up as a mismatch.
  ["internal", fkasPrivate, tkasCompany],
  ["fkas", fkasExternal, fkasPrivate],
  ["tkas", tkasCompany, fkasPrivate],
  ["guen", guenExternal, tkasCompany],
];

describe("radius roles", () => {
  let restoreDocumentTheme: () => void = () => undefined;

  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
    document.documentElement.style.fontSize = "16px";
  });

  afterEach(() => {
    restoreDocumentTheme();
    document.documentElement.style.removeProperty("font-size");
  });

  it("rounds every element from the document theme's radius roles", () => {
    for (const [variant, theme] of CASES) {
      stampDocumentTheme(theme, "light");
      const { unmount } = render(<Specimens />);
      expectRadii(variant, `document ${variant}`);
      unmount();
    }
  });

  it("rounds a nested theme scope from its own radius roles, not the document's", () => {
    for (const [variant, theme, documentTheme] of CASES) {
      stampDocumentTheme(documentTheme, "light");
      const { unmount } = render(
        <ThemeScope theme={theme}>
          <Specimens />
        </ThemeScope>
      );
      expectRadii(variant, `scope ${variant}`);
      unmount();
    }
  });

  it("gives every internal element the same radius", () => {
    stampDocumentTheme(fkasPrivate, "light");
    render(<Specimens />);
    const radii = new Set(measure().map(([, , measured]) => measured));
    expect([...radii]).toEqual([6]);
  });

  it("moves every internal element together when the document overrides --radius", () => {
    stampDocumentTheme(fkasPrivate, "light");
    document.documentElement.style.setProperty("--radius", "1rem");
    try {
      render(<Specimens />);
      for (const [, name, measured] of measure()) {
        expect(measured, name).toBeCloseTo(16, 1);
      }
    } finally {
      document.documentElement.style.removeProperty("--radius");
    }
  });

  it("moves every internal element together when a nested theme scope overrides --radius", () => {
    stampDocumentTheme(tkasCompany, "light");
    render(
      <ThemeScope theme={fkasPrivate} style={{ "--radius": "1rem" }}>
        <Specimens />
      </ThemeScope>
    );
    for (const [, name, measured] of measure()) {
      expect(measured, name).toBeCloseTo(16, 1);
    }
  });

  it("resolves a host rule's plain var(--radius-button) read to the theme's button radius", () => {
    const host = (
      <div role="group" aria-label="Host button" style={{ borderRadius: "var(--radius-button)" }} />
    );
    // Internal themes alias the button radius to --radius, 0.375rem. fkas sets 1.8125rem.
    for (const [theme, expected] of [
      [fkasPrivate, 6],
      [fkasExternal, 29],
    ] as const) {
      stampDocumentTheme(theme, "light");
      const { unmount } = render(host);
      expect(radius(roleNamed("group", "Host button")), themeSlug(theme)).toBe(expected);
      unmount();
    }
  });
});
