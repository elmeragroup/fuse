import type { CSSProperties, ReactElement } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { shadowLayers } from "../../test/assert-invalid-ring";
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
import { ButtonGroup } from "../components/button-group";
import { Button } from "../components/button/button";
import { Card } from "../components/card/card";
import { Checkbox } from "../components/checkbox/checkbox";
import { Combobox } from "../components/combobox";
import { Frame } from "../components/frame/frame";
import { InputGroup } from "../components/input-group";
import { Input } from "../components/input/input";
import { PhoneNumberField } from "../components/phone-number-field/phone-number-field";
import { Tabs } from "../components/tabs";
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
import { EXTERNAL_VARIANT_LAYER } from "./tokens/external-palettes";
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
  | "date segment"
  | "preset"
  | "chip remove";

type Variant = "internal" | "fkas" | "tkas" | "guen";

/**
 * Corner radii in px. Internal rounds every element with `--radius`, 0.375rem (6px). An
 * external button rounds with the brand's `--radius-button`, which is 1.8125rem (29px) for
 * fkas, 1rem (16px) for tkas and 0.5rem (8px) for guen. An external field box rounds
 * with the external variant's `--radius-field`, 0.25rem (4px), whatever the brand, and
 * nothing inside it rounds more: the kbd and the xs addons take the smaller of 5px inside
 * `--radius` and 4px, so guen's stay at 3px, a date segment takes the smaller of `rounded-xs`
 * and 4px, so guen's stays at 2px, and the sm addons, the search clear button, the date
 * trigger and the chip remove button take 4px. The other external values are the ones
 * Chromium measured on origin/main (e178f6d7) with each theme on the document. The tkas row
 * has since moved 0.8px with its `--radius`, from 0.95rem to 1rem.
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
    "date segment": 6,
    preset: 6,
    "chip remove": 6,
  },
  fkas: {
    button: 29,
    "grouped button": 10,
    card: 12,
    input: 4,
    badge: 12,
    toggle: 10,
    "toggle xs": 10,
    checkbox: 4,
    "input group": 4,
    kbd: 4,
    "addon xs": 4,
    "addon sm": 4,
    frame: 16,
    calendar: 4,
    "calendar nav": 29,
    tab: 10,
    "phone trigger": 4,
    "search clear": 4,
    "date trigger": 4,
    "date segment": 4,
    preset: 10,
    "chip remove": 4,
  },
  tkas: {
    button: 16,
    "grouped button": 14,
    card: 16,
    input: 4,
    badge: 16,
    toggle: 14,
    "toggle xs": 10,
    checkbox: 4,
    "input group": 4,
    kbd: 4,
    "addon xs": 4,
    "addon sm": 4,
    frame: 20,
    calendar: 4,
    "calendar nav": 16,
    tab: 14,
    "phone trigger": 4,
    "search clear": 4,
    "date trigger": 4,
    "date segment": 4,
    preset: 10,
    "chip remove": 4,
  },
  guen: {
    button: 8,
    "grouped button": 6,
    card: 8,
    input: 4,
    badge: 8,
    toggle: 6,
    "toggle xs": 6,
    checkbox: 4,
    "input group": 4,
    kbd: 3,
    "addon xs": 3,
    "addon sm": 4,
    frame: 12,
    calendar: 4,
    "calendar nav": 8,
    tab: 6,
    "phone trigger": 4,
    "search clear": 4,
    "date trigger": 4,
    "date segment": 2,
    preset: 6,
    "chip remove": 4,
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

/**
 * A host that keeps its own tokens: `--radius` and `--border` are its own, and the
 * variant-layer roles (`--radius-step` and the button outline roles), which only themes.css
 * sets, are not declared. `initial` resets each inherited role to the guaranteed invalid
 * value, so every `var(--radius-step, 0px)` and outline role read takes its fallback here.
 */
const HOST_WITHOUT_THEMES = {
  "--radius": "8px",
  "--border": "rgb(10, 20, 30)",
  ...Object.fromEntries(Object.keys(EXTERNAL_VARIANT_LAYER).map((key) => [`--${key}`, "initial"])),
} as const;

function HostSpecimens({ style = HOST_WITHOUT_THEMES }: { style?: CSSProperties }): ReactElement {
  return withLocale(
    "en-US",
    <div style={style}>
      <Card.Root role="group" aria-label="Host card" />
      <Input aria-label="Host input" />
      <Frame.Root role="group" aria-label="Host frame" />
      <Checkbox aria-label="Host checkbox" />
      <Toggle size="xs">Host toggle xs</Toggle>
      <Button variant="outline">Host outline</Button>
      <InputGroup.Root aria-label="Host input group">
        <InputGroup.Input aria-label="Host grouped input" />
        <InputGroup.Addon align="inline-end">
          <kbd>K</kbd>
          <InputGroup.Button size="xs">Host addon xs</InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    </div>
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

/** The date picker's first segment, which paints its focus fill inside the field box. */
function dateSegment(): HTMLElement {
  const element = page.getByRole("spinbutton").first().element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the date picker's first segment");
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
    ["date segment", "Date segment", radius(dateSegment())],
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

  it("moves internal fields, not buttons, with a --radius override on a plain wrapper", () => {
    // The theme element resolves --radius-button, so a wrapper below it leaves buttons alone.
    // Internal fields read --radius on the element itself, as cards do.
    stampDocumentTheme(fkasPrivate, "light");
    render(
      <div style={{ "--radius": "1rem" }}>
        <Input aria-label="Wrapped input" />
        <Button aria-label="Wrapped button" />
      </div>
    );
    expect(radius(roleNamed("textbox", "Wrapped input"))).toBe(16);
    expect(radius(roleNamed("button", "Wrapped button"))).toBe(6);
  });

  it("rounds external fields with a --radius-field override and caps their addons at it", () => {
    stampDocumentTheme(tkasCompany, "light");
    render(
      <ThemeScope theme={fkasExternal} style={{ "--radius-field": "0.125rem" }}>
        <Specimens />
      </ThemeScope>
    );
    for (const [specimen, name] of [
      ["input", "Input"],
      ["input group", "Input group"],
      ["kbd", "Kbd"],
      ["addon xs", "Addon xs"],
      ["addon sm", "Addon sm"],
      ["search clear", "Clear search"],
      ["date trigger", "Date trigger"],
      ["date segment", "Date segment"],
      ["chip remove", "Remove Apple"],
      ["phone trigger", "Select country"],
    ] as const) {
      const measured = measure().find(([candidate, label]) => candidate === specimen && label === name);
      expect(measured?.[2], name).toBe(2);
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

describe("a host without themes.css", () => {
  it("rounds every rung and private corner with the host's own --radius when --radius-step is unset", () => {
    render(<HostSpecimens />);
    const host = px(HOST_WITHOUT_THEMES["--radius"]);
    // Across the scale: rounded-lg (card), rounded-md (input) and rounded-xl (frame) all
    // collapse onto the host radius at a 0px step, as the private corners do.
    for (const [label, element] of [
      ["card", roleNamed("group", "Host card")],
      ["input", roleNamed("textbox", "Host input")],
      ["frame", roleNamed("group", "Host frame")],
      ["checkbox", roleNamed("checkbox", "Host checkbox")],
      ["toggle xs", roleNamed("button", "Host toggle xs")],
      ["input group", roleNamed("group", "Host input group")],
      ["addon xs", roleNamed("button", "Host addon xs")],
    ] as const) {
      expect(radius(element), label).toBe(host);
    }
  });

  it("rounds fields with its own --radius-field once it sets the external --radius-step", () => {
    const host = (step: Record<string, string>) =>
      render(<HostSpecimens style={{ ...HOST_WITHOUT_THEMES, "--radius-step": "2px", ...step }} />);
    // A 4px field corner under a 8px host --radius: the xs addon and the kbd would sit 5px
    // inside --radius, at 3px, which is already under the field corner.
    const { unmount } = host({ "--radius-field": "4px" });
    expect(radius(roleNamed("textbox", "Host input"))).toBe(4);
    expect(radius(roleNamed("group", "Host input group"))).toBe(4);
    expect(radius(roleNamed("button", "Host addon xs"))).toBe(3);
    expect(radius(textNamed("K"))).toBe(3);
    unmount();
    // Without the role the field falls back to the host's --radius.
    host({});
    expect(radius(roleNamed("textbox", "Host input"))).toBe(8);
  });

  it("draws the outline Button as the host's --border hairline with shadow-xs", () => {
    render(<HostSpecimens />);
    const style = getComputedStyle(roleNamed("button", "Host outline"));
    expect(style.borderTopWidth).toBe("1px");
    expect(style.borderTopColor).toBe(HOST_WITHOUT_THEMES["--border"]);
    // Tailwind's shadow-xs, which the hairline casts, in the --tw-shadow layer behind the
    // transparent ring layers.
    expect(shadowLayers(style.boxShadow).at(-1)).toBe("rgba(0, 0, 0, 0.05) 0px 1px 2px 0px");
  });
});
