import type { CSSProperties, ReactElement } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { shadowLayers } from "../../test/assert-invalid-ring";
import { render } from "../../test/browser-render";
import { edgeInset } from "../../test/inner-corner-specimens";
import type { PartEdge } from "../../test/inner-corner-specimens";
import { withLocale } from "../../test/locale-matrix";
import { fkasExternal, fkasPrivate, tkasCompany } from "../../test/theme-fixtures";
import {
  px,
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
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
import { DENSITIES } from "./density";
import type { Density } from "./density";
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
 * Corner radii in px. Internal rounds every outer element with `--radius`, 0.375rem (6px). An
 * external button rounds with the brand's `--radius-button`, which is 1.8125rem (29px) for
 * fkas, 1rem (16px) for tkas and 0.5rem (8px) for guen. An external field box rounds
 * with the external variant's `--radius-field`, 0.25rem (4px), whatever the brand. The other
 * outer external values are the ones Chromium measured on origin/main (e178f6d7) with each
 * theme on the document. The tkas row has since moved 0.8px with its `--radius`, from 0.95rem
 * to 1rem.
 *
 * Inner parts round with the field corner (6px internal, 4px external) or their shell's rung
 * less the inset, floored at 0: the xs and sm addons, the phone trigger and the search clear
 * button sit 5px in, so they take 1px internal and 0px external; the kbd sits 6.6px in and
 * the chips 7px, so the kbd and the chip remove button take 0px; the date trigger sits flush
 * behind the 1px border, at 5px internal and 3px external; and a date segment sits behind the
 * border and the dense 10px control inset, at 0px. A tab sits 4px inside the list's
 * `rounded-lg`: 2px internal, 8px fkas, 12px tkas and 4px guen. A preset sits 5px inside the
 * popover's `rounded-md`, its 1px border and the 4px small surface tier: 1px internal, 5px fkas,
 * 9px tkas and 1px guen.
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
    kbd: 0,
    "addon xs": 1,
    "addon sm": 1,
    frame: 6,
    calendar: 6,
    "calendar nav": 6,
    tab: 2,
    "phone trigger": 1,
    "search clear": 1,
    "date trigger": 5,
    "date segment": 0,
    preset: 1,
    "chip remove": 0,
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
    kbd: 0,
    "addon xs": 0,
    "addon sm": 0,
    frame: 16,
    calendar: 4,
    "calendar nav": 29,
    tab: 8,
    "phone trigger": 0,
    "search clear": 0,
    "date trigger": 3,
    "date segment": 0,
    preset: 5,
    "chip remove": 0,
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
    kbd: 0,
    "addon xs": 0,
    "addon sm": 0,
    frame: 20,
    calendar: 4,
    "calendar nav": 16,
    tab: 12,
    "phone trigger": 0,
    "search clear": 0,
    "date trigger": 3,
    "date segment": 0,
    preset: 9,
    "chip remove": 0,
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
    kbd: 0,
    "addon xs": 0,
    "addon sm": 0,
    frame: 12,
    calendar: 4,
    "calendar nav": 8,
    tab: 4,
    "phone trigger": 0,
    "search clear": 0,
    "date trigger": 3,
    "date segment": 0,
    preset: 1,
    "chip remove": 0,
  },
} as const satisfies Record<Variant, Record<Specimen, number>>;

/**
 * The internal radii at a 1rem (16px) `--radius`: every outer element at 16px, and each inner
 * part 16px less its inset from {@link EXPECTED}: 6.6px for the kbd, 5px for the addons, the
 * phone trigger and the search clear button, 1px for the date trigger, 11px for a date
 * segment, 4px for a tab and 5px for a preset. The chip remove button sits 2px inside a chip
 * that sits 7px in, so it takes 7px.
 */
const INTERNAL_AT_16PX = {
  button: 16,
  "grouped button": 16,
  card: 16,
  input: 16,
  badge: 16,
  toggle: 16,
  "toggle xs": 16,
  checkbox: 16,
  "input group": 16,
  kbd: 9.4,
  "addon xs": 11,
  "addon sm": 11,
  frame: 16,
  calendar: 16,
  "calendar nav": 16,
  tab: 12,
  "phone trigger": 11,
  "search clear": 11,
  "date trigger": 15,
  "date segment": 5,
  preset: 11,
  "chip remove": 7,
} as const satisfies Record<Specimen, number>;

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
      {/* Each inner part ends its own field box, so it sits at the box's corner. */}
      <InputGroup.Root aria-label="Input group">
        <InputGroup.Input aria-label="Grouped input" />
        <InputGroup.Addon align="inline-end">
          <kbd>K</kbd>
        </InputGroup.Addon>
      </InputGroup.Root>
      {(
        [
          ["xs", "Addon xs"],
          ["sm", "Addon sm"],
          ["icon-xs", "Addon icon-xs"],
          ["icon-sm", "Addon icon-sm"],
        ] as const
      ).map(([size, name]) => (
        <InputGroup.Root key={size} aria-label={`${name} group`}>
          <InputGroup.Input aria-label={`${name} input`} />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button size={size} aria-label={name}>
              {size.startsWith("icon") ? null : name}
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      ))}
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

/** The element with a slot around `part`. DOM audit: field boxes and chips have no role. */
function slotAround(part: HTMLElement, slot: string): HTMLElement {
  const shell = part.closest(`[data-slot="${slot}"]`);
  if (!(shell instanceof HTMLElement)) {
    throw new Error(`expected ${slot} around ${part.textContent}`);
  }
  return shell;
}

/**
 * Each inner specimen, the shell whose corner it sits in, and the inline edge where they meet.
 * The chip remove button sits in a chip, whose corner it shares.
 */
function innerSpecimens(): readonly (readonly [string, HTMLElement, HTMLElement, PartEdge])[] {
  const addon = (name: string) =>
    [name, roleNamed("button", name), roleNamed("group", `${name} group`), "end"] as const;
  const country = roleNamed("button", "Select country");
  const clear = roleNamed("button", "Clear search");
  const trigger = dateTrigger();
  const segment = dateSegment();
  const remove = roleNamed("button", "Remove Apple");
  const tab = roleNamed("tab", "Tab");
  return [
    ["Kbd", textNamed("K"), roleNamed("group", "Input group"), "end"],
    addon("Addon xs"),
    addon("Addon icon-xs"),
    addon("Addon sm"),
    addon("Addon icon-sm"),
    ["Select country", country, slotAround(country, "input-group"), "start"],
    ["Clear search", clear, slotAround(clear, "field-group"), "end"],
    ["Date trigger", trigger, slotAround(trigger, "field-group"), "end"],
    ["Date segment", segment, slotAround(segment, "field-group"), "start"],
    ["Remove Apple", remove, slotAround(remove, "combobox-chip"), "end"],
    ["Tab", tab, slotAround(tab, "tabs-list"), "start"],
  ];
}

/**
 * Unit under test: each inner specimen's `rounded-inner` corner. Oracle: the concentric rule
 * max(0, outer − inset), applied to its shell's measured corner and the inset measured between
 * their boxes. The hand-computed corners are {@link EXPECTED}.
 */
function expectConcentric(context: string): void {
  for (const [name, part, shell, edge] of innerSpecimens()) {
    expect(radius(part), `${context} ${name}`).toBeCloseTo(
      Math.max(0, radius(shell) - edgeInset(part, shell, edge)),
      1
    );
  }
}

/**
 * The radii that differ when comfortable. An addon pads with `--control-px-icon-md`, 12px
 * comfortable, so a button pulled 4px into it, an addon button or the phone field's country
 * trigger, sits 9px inside the field box, past the internal 6px field corner, and rounds at 0.
 * The external field corner already floors at 0 dense.
 */
const COMFORTABLE = {
  internal: { "addon xs": 0, "addon sm": 0, "phone trigger": 0 },
} as const satisfies { readonly [V in Variant]?: { readonly [S in Specimen]?: number } };

/** The comfortable radius of `specimen` where it differs from the dense one. */
function comfortableRadius(variant: Variant, specimen: Specimen): number | undefined {
  if (variant !== "internal") {
    return undefined;
  }
  const overrides: { readonly [S in Specimen]?: number } = COMFORTABLE.internal;
  return overrides[specimen];
}

function expectRadii(variant: Variant, context: string, density: Density = "dense"): void {
  for (const [specimen, name, measured] of measure()) {
    const expected =
      (density === "comfortable" ? comfortableRadius(variant, specimen) : undefined) ??
      EXPECTED[variant][specimen];
    expect(measured, `${context} ${name}`).toBeCloseTo(expected, 1);
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

  it("rounds a nested theme scope from its own radius roles, each inner part inside its shell, at both densities", () => {
    for (const density of DENSITIES) {
      stampDensity(density);
      for (const [variant, theme, documentTheme] of CASES) {
        stampDocumentTheme(documentTheme, "light");
        const { unmount } = render(
          <ThemeScope theme={theme}>
            <Specimens />
          </ThemeScope>
        );
        expectRadii(variant, `${density} ${variant}`, density);
        expectConcentric(`${density} ${variant}`);
        unmount();
      }
    }
  });

  it("moves every internal element with a document --radius override, inner parts inside it", () => {
    stampDocumentTheme(fkasPrivate, "light");
    document.documentElement.style.setProperty("--radius", "1rem");
    try {
      render(<Specimens />);
      for (const [specimen, name, measured] of measure()) {
        expect(measured, name).toBeCloseTo(INTERNAL_AT_16PX[specimen], 1);
      }
    } finally {
      document.documentElement.style.removeProperty("--radius");
    }
  });

  it("moves every internal element with a nested scope's --radius override, inner parts inside it", () => {
    stampDocumentTheme(tkasCompany, "light");
    render(
      <ThemeScope theme={fkasPrivate} style={{ "--radius": "1rem" }}>
        <Specimens />
      </ThemeScope>
    );
    for (const [specimen, name, measured] of measure()) {
      expect(measured, name).toBeCloseTo(INTERNAL_AT_16PX[specimen], 1);
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

  it("rounds external fields with a --radius-field override and insets their parts from it", () => {
    stampDocumentTheme(tkasCompany, "light");
    render(
      <ThemeScope theme={fkasExternal} style={{ "--radius-field": "0.125rem" }}>
        <Specimens />
      </ThemeScope>
    );
    // The boxes take the 2px corner. Only the date trigger, 1px in, keeps a corner inside it.
    for (const [specimen, name, expected] of [
      ["input", "Input", 2],
      ["input group", "Input group", 2],
      ["kbd", "Kbd", 0],
      ["addon xs", "Addon xs", 0],
      ["addon sm", "Addon sm", 0],
      ["search clear", "Clear search", 0],
      ["date trigger", "Date trigger", 1],
      ["date segment", "Date segment", 0],
      ["chip remove", "Remove Apple", 0],
      ["phone trigger", "Select country", 0],
    ] as const) {
      const measured = measure().find(([candidate, label]) => candidate === specimen && label === name);
      expect(measured?.[2], name).toBe(expected);
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
    ] as const) {
      expect(radius(element), label).toBe(host);
    }
    // The xs addon sits 5px inside the host's 8px field corner.
    expect(radius(roleNamed("button", "Host addon xs")), "addon xs").toBe(3);
  });

  it("rounds fields with its own --radius-field once it sets the external --radius-step", () => {
    const host = (step: Record<string, string>) =>
      render(<HostSpecimens style={{ ...HOST_WITHOUT_THEMES, "--radius-step": "2px", ...step }} />);
    // A 4px field corner: the xs addon sits 5px and the kbd 6.6px inside it, so both are square.
    const { unmount } = host({ "--radius-field": "4px" });
    expect(radius(roleNamed("textbox", "Host input"))).toBe(4);
    expect(radius(roleNamed("group", "Host input group"))).toBe(4);
    expect(radius(roleNamed("button", "Host addon xs"))).toBe(0);
    expect(radius(textNamed("K"))).toBe(0);
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
