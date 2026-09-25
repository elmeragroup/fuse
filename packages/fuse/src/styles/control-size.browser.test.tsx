import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "../../dist/styles.css";
import { withLocale } from "../../test/locale-matrix";
import {
  CONTROL_LG,
  CONTROL_MD,
  CONTROL_SM,
  CONTROL_XS,
  fkasExternal,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../test/themed-browser-render";
import type { ControlSizeName, QueryableRole } from "../../test/themed-browser-render";
import { Button } from "../components/button/button";
import { Combobox } from "../components/combobox/combobox";
import { RadioGroup, RadioIconButton } from "../components/radio-group/radio-group";
import { Select } from "../components/select/select";
import { Sidebar } from "../components/sidebar/sidebar";
import { Tabs } from "../components/tabs/tabs";
import { ToggleGroup } from "../components/toggle-group/toggle-group";
import { Toggle } from "../components/toggle/toggle";
import type { Density } from "../theme/density";
import { ThemeScope } from "../theme/theme-scope";

/**
 * Control size: every consumer of the size × fit recipe, of its metric parts and of the
 * resolved md parts, measured at both densities.
 *
 * The oracle is `DENSITY_METRICS`, through the `CONTROL_*` pixel tables the shared harness
 * derives from it (`density-css.test.ts` ties that module to `fuse.css`). The xs and sm type
 * is Tailwind's fixed `text-xs` / `text-sm`, which no density owns, so its pixels are
 * written here by hand.
 */

const DENSITIES = ["dense", "comfortable"] as const;

/** The pixel metrics one control size resolves to at one density. */
type SizeMetrics = {
  readonly height: number;
  readonly px: number;
  readonly pxIcon: number;
  readonly gap: number;
  readonly font: number;
  readonly leading: number;
};

/** Tailwind's `text-xs` and `text-sm` at the 16px root: 0.75rem / 1rem and 0.875rem / 1.25rem. */
const FIXED_TYPE = {
  xs: { font: 12, leading: 16 },
  sm: { font: 14, leading: 20 },
} as const;

function expectedMetrics(size: ControlSizeName, density: Density): SizeMetrics {
  switch (size) {
    case "xs":
      return { ...CONTROL_XS[density], ...FIXED_TYPE.xs };
    case "sm":
      return { ...CONTROL_SM[density], ...FIXED_TYPE.sm };
    case "md":
      return CONTROL_MD[density];
    case "lg":
      return CONTROL_LG[density];
  }
}

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

/** A label-fit control's three probes: bare, with a leading icon, with a trailing icon. */
type LabelProbe = {
  readonly consumer: string;
  readonly role: QueryableRole;
  readonly size: ControlSizeName;
  readonly fit: "label" | "min-square";
  /** Whether the consumer maps `data-icon="inline-*"` children onto the icon-edge inset. */
  readonly iconEdges: boolean;
  readonly render: (name: string, icon: "none" | "start" | "end") => ReactNode;
};

function iconChildren(icon: "none" | "start" | "end"): ReactNode {
  switch (icon) {
    case "none":
      return "Label";
    case "start":
      return (
        <>
          <span data-icon="inline-start" aria-hidden>
            *
          </span>
          Label
        </>
      );
    case "end":
      return (
        <>
          Label
          <span data-icon="inline-end" aria-hidden>
            *
          </span>
        </>
      );
  }
}

const BUTTON_LABEL_SIZES = { xs: "xs", sm: "sm", md: "default", lg: "lg" } as const;
const TOGGLE_SIZES = { xs: "xs", sm: "sm", md: "default", lg: "lg" } as const;
const SELECT_SIZES = { sm: "sm", md: "default" } as const;

const LABEL_PROBES: readonly LabelProbe[] = [
  ...(["xs", "sm", "md", "lg"] as const).map((size): LabelProbe => ({
    consumer: "button",
    role: "button",
    size,
    fit: "label",
    iconEdges: true,
    render: (name, icon) => (
      <Button size={BUTTON_LABEL_SIZES[size]} aria-label={name}>
        {iconChildren(icon)}
      </Button>
    ),
  })),
  ...(["xs", "sm", "md", "lg"] as const).map((size): LabelProbe => ({
    consumer: "toggle",
    role: "button",
    size,
    fit: "min-square",
    iconEdges: true,
    render: (name, icon) => (
      <Toggle size={TOGGLE_SIZES[size]} aria-label={name}>
        {iconChildren(icon)}
      </Toggle>
    ),
  })),
  ...(["xs", "sm", "md", "lg"] as const).map((size): LabelProbe => ({
    consumer: "toggle-group item",
    role: "button",
    size,
    fit: "min-square",
    iconEdges: true,
    render: (name, icon) => (
      <ToggleGroup.Root aria-label={`${name} group`} size={TOGGLE_SIZES[size]}>
        <ToggleGroup.Item value="one" aria-label={name}>
          {iconChildren(icon)}
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    ),
  })),
  ...(["sm", "md"] as const).map((size): LabelProbe => ({
    consumer: "select trigger",
    role: "combobox",
    size,
    fit: "label",
    // The trigger has never mapped icon children onto the icon edge, so its padding stays
    // the label inset with an icon child too.
    iconEdges: false,
    render: (name, icon) => (
      <Select.Root>
        <Select.Trigger size={SELECT_SIZES[size]} aria-label={name}>
          {icon === "start" ? iconChildren("start") : null}
          <Select.Value placeholder="Pick" />
          {icon === "end" ? iconChildren("end") : null}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="a">A</Select.Item>
        </Select.Content>
      </Select.Root>
    ),
  })),
];

function measure(role: QueryableRole, name: string) {
  return measureElement(roleNamed(role, name));
}

function measureElement(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    height: px(style.height),
    width: px(style.width),
    minWidth: style.minWidth,
    minHeight: style.minHeight,
    paddingStart: px(style.paddingInlineStart),
    paddingEnd: px(style.paddingInlineEnd),
    gap: style.columnGap,
    font: style.fontSize,
    leading: style.lineHeight,
  };
}

function probeName(probe: LabelProbe, icon: "none" | "start" | "end", density: Density): string {
  return `${probe.consumer} ${probe.size} ${icon} ${density}`;
}

describe("control size: label and min-square fits", () => {
  it("guards the oracle: every metric the suite checks differs between the densities", () => {
    for (const size of ["xs", "sm", "md", "lg"] as const) {
      const dense = expectedMetrics(size, "dense");
      const comfortable = expectedMetrics(size, "comfortable");
      expect(comfortable.height, size).not.toBe(dense.height);
      expect(comfortable.px, size).not.toBe(dense.px);
      expect(comfortable.pxIcon, size).not.toBe(dense.pxIcon);
      expect(comfortable.gap, size).not.toBe(dense.gap);
    }
    expect(CONTROL_MD.comfortable.font).not.toBe(CONTROL_MD.dense.font);
    expect(CONTROL_MD.comfortable.leading).not.toBe(CONTROL_MD.dense.leading);
  });

  it.each(DENSITIES)("resolves every consumer × size at %s", (density) => {
    stampDensity(density);
    renderThemed(
      <>
        {LABEL_PROBES.flatMap((probe) =>
          (["none", "start", "end"] as const).map((icon) => (
            <div key={probeName(probe, icon, density)}>
              {probe.render(probeName(probe, icon, density), icon)}
            </div>
          ))
        )}
      </>
    );

    for (const probe of LABEL_PROBES) {
      const expected = expectedMetrics(probe.size, density);
      const label = `${density} ${probe.consumer} ${probe.size}`;
      const bare = measure(probe.role, probeName(probe, "none", density));
      expect(bare.height, `${label} height`).toBe(expected.height);
      expect(bare.paddingStart, `${label} padding start`).toBe(expected.px);
      expect(bare.paddingEnd, `${label} padding end`).toBe(expected.px);
      expect(px(bare.gap), `${label} gap`).toBe(expected.gap);
      expect(px(bare.font), `${label} font`).toBe(expected.font);
      expect(px(bare.leading), `${label} leading`).toBe(expected.leading);
      if (probe.fit === "min-square") {
        expect(bare.minWidth, `${label} min-width`).toBe(`${String(expected.height)}px`);
      }

      const edge = probe.iconEdges ? expected.pxIcon : expected.px;
      const start = measure(probe.role, probeName(probe, "start", density));
      expect(start.paddingStart, `${label} icon-start edge`).toBe(edge);
      expect(start.paddingEnd, `${label} icon-start far edge`).toBe(expected.px);
      const end = measure(probe.role, probeName(probe, "end", density));
      expect(end.paddingEnd, `${label} icon-end edge`).toBe(edge);
      expect(end.paddingStart, `${label} icon-end far edge`).toBe(expected.px);
    }
  });

  it.each(DENSITIES)(
    "insets a segmented toggle-group item by the icon edge on both sides at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <>
          {(["xs", "sm", "md", "lg"] as const).map((size) => (
            <ToggleGroup.Root
              key={size}
              aria-label={`segmented ${size}`}
              spacing={0}
              size={TOGGLE_SIZES[size]}>
              <ToggleGroup.Item value="one" aria-label={`segment ${size}`}>
                Label
              </ToggleGroup.Item>
              <ToggleGroup.Item value="two" aria-label={`segment ${size} icon`}>
                {iconChildren("start")}
              </ToggleGroup.Item>
            </ToggleGroup.Root>
          ))}
        </>
      );

      for (const size of ["xs", "sm", "md", "lg"] as const) {
        const expected = expectedMetrics(size, density);
        for (const name of [`segment ${size}`, `segment ${size} icon`]) {
          const box = measure("button", name);
          expect(box.height, `${density} ${name} height`).toBe(expected.height);
          expect(box.minWidth, `${density} ${name} min-width`).toBe(`${String(expected.height)}px`);
          expect(box.paddingStart, `${density} ${name} padding start`).toBe(expected.pxIcon);
          expect(box.paddingEnd, `${density} ${name} padding end`).toBe(expected.pxIcon);
        }
      }
    }
  );
});

describe("control size: square fit", () => {
  const BUTTON_SQUARES = [
    ["icon-xs", "xs"],
    ["icon-sm", "sm"],
    ["icon", "md"],
    ["icon-lg", "lg"],
  ] as const;
  const RADIO_SQUARES = [
    ["icon-xxs", "xs"],
    ["icon-xs", "xs"],
    ["icon-sm", "sm"],
    ["icon", "md"],
    ["icon-lg", "lg"],
  ] as const;

  it.each(DENSITIES)("sizes Button and RadioIconButton squares at %s", (density) => {
    stampDensity(density);
    renderThemed(
      <>
        {BUTTON_SQUARES.map(([size]) => (
          <Button key={size} size={size} aria-label={`button ${size}`} />
        ))}
        <RadioGroup label="Squares">
          {RADIO_SQUARES.map(([size]) => (
            <RadioIconButton key={size} value={size} size={size} aria-label={`radio ${size}`}>
              <svg aria-hidden viewBox="0 0 1 1" />
            </RadioIconButton>
          ))}
        </RadioGroup>
      </>
    );

    for (const [size, controlSize] of BUTTON_SQUARES) {
      const side = expectedMetrics(controlSize, density).height;
      const box = measure("button", `button ${size}`);
      expect(box.height, `${density} button ${size} height`).toBe(side);
      expect(box.width, `${density} button ${size} width`).toBe(side);
    }
    for (const [size, controlSize] of RADIO_SQUARES) {
      const side = expectedMetrics(controlSize, density).height;
      const box = measure("radio", `radio ${size}`);
      expect(box.height, `${density} radio ${size} height`).toBe(side);
      expect(box.width, `${density} radio ${size} width`).toBe(side);
    }
  });

  it.each(DENSITIES)("keeps every smallest target at or above 24px at %s", (density) => {
    stampDensity(density);
    renderThemed(
      <>
        <Button size="icon-xs" aria-label="smallest button" />
        <Toggle size="xs" aria-label="smallest toggle" />
        <RadioGroup label="Smallest">
          <RadioIconButton value="xxs" size="icon-xxs" aria-label="smallest radio">
            <svg aria-hidden viewBox="0 0 1 1" />
          </RadioIconButton>
        </RadioGroup>
      </>
    );
    for (const [role, name] of [
      ["button", "smallest button"],
      ["button", "smallest toggle"],
      ["radio", "smallest radio"],
    ] as const) {
      const box = measure(role, name);
      expect(box.height, `${density} ${name} height`).toBeGreaterThanOrEqual(24);
      expect(box.width, `${density} ${name} width`).toBeGreaterThanOrEqual(24);
    }
  });

  it("keeps Button's icon-inline square out of the density metrics", () => {
    stampDensity("dense");
    renderThemed(<Button size="icon-inline" aria-label="inline dense" />);
    const dense = measure("button", "inline dense");

    stampDensity("comfortable");
    renderThemed(<Button size="icon-inline" aria-label="inline comfortable" />);
    const comfortable = measure("button", "inline comfortable");

    expect(comfortable.height).toBe(dense.height);
    expect(comfortable.width).toBe(dense.width);
  });
});

describe("control size: the resolved md parts", () => {
  it.each(DENSITIES)("binds Tabs, Sidebar sub-buttons and the Combobox chips at %s", (density) => {
    stampDensity(density);
    renderThemed(
      withLocale(
        "en-US",
        <>
          <Tabs.Root defaultValue="bare">
            <Tabs.List>
              <Tabs.Trigger value="bare" aria-label="tab bare">
                {iconChildren("none")}
              </Tabs.Trigger>
              <Tabs.Trigger value="start" aria-label="tab start">
                {iconChildren("start")}
              </Tabs.Trigger>
              <Tabs.Trigger value="end" aria-label="tab end">
                {iconChildren("end")}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
          <Sidebar.MenuSubButton href="#md">sub md</Sidebar.MenuSubButton>
          <Sidebar.MenuSubButton href="#sm" size="sm">
            sub sm
          </Sidebar.MenuSubButton>
          <Combobox.Root multiple items={["a"]}>
            <Combobox.Chips>
              <Combobox.ChipsInput aria-label="chips input" />
            </Combobox.Chips>
          </Combobox.Root>
        </>
      )
    );

    const md = expectedMetrics("md", density);
    const sm = expectedMetrics("sm", density);

    const bare = measure("tab", "tab bare");
    expect(bare.paddingStart, `${density} tab padding start`).toBe(md.px);
    expect(bare.paddingEnd, `${density} tab padding end`).toBe(md.px);
    expect(px(bare.gap), `${density} tab gap`).toBe(md.gap);
    expect(px(bare.font), `${density} tab font`).toBe(md.font);
    expect(px(bare.leading), `${density} tab leading`).toBe(md.leading);
    expect(measure("tab", "tab start").paddingStart, `${density} tab icon-start edge`).toBe(md.pxIcon);
    expect(measure("tab", "tab end").paddingEnd, `${density} tab icon-end edge`).toBe(md.pxIcon);

    const subMd = measure("link", "sub md");
    expect(subMd.height, `${density} sub md height`).toBe(md.height);
    expect(px(subMd.font), `${density} sub md font`).toBe(md.font);
    expect(px(subMd.leading), `${density} sub md leading`).toBe(md.leading);
    const subSm = measure("link", "sub sm");
    expect(subSm.height, `${density} sub sm height`).toBe(sm.height);
    expect(px(subSm.font), `${density} sub sm font`).toBe(sm.font);
    expect(px(subSm.leading), `${density} sub sm leading`).toBe(sm.leading);

    // Base UI gives the chips box its toolbar role only once it holds a chip, and a chip
    // swaps the box's inset for the compact chip padding, so the empty box is reached from
    // its input.
    const chipsBox = roleNamed("combobox", "chips input").parentElement;
    if (chipsBox === null) {
      throw new Error("expected the chips box around its input");
    }
    const chips = measureElement(chipsBox);
    expect(chips.minHeight, `${density} chips min-height`).toBe(`${String(md.height)}px`);
    expect(chips.paddingStart, `${density} chips padding start`).toBe(md.px);
    expect(chips.paddingEnd, `${density} chips padding end`).toBe(md.px);
  });
});

describe("control size: density scope", () => {
  it("follows the document stamp, not a nested data-density or ThemeScope", () => {
    stampDensity("dense");
    renderThemed(
      <>
        <div data-density="comfortable">
          <Button>nested button</Button>
          <Toggle>nested toggle</Toggle>
          <Select.Root>
            <Select.Trigger aria-label="nested select">
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
          </Select.Root>
        </div>
        <ThemeScope theme={fkasExternal}>
          <Button>scoped button</Button>
          <Toggle>scoped toggle</Toggle>
          <Select.Root>
            <Select.Trigger aria-label="scoped select">
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
          </Select.Root>
        </ThemeScope>
      </>
    );
    for (const [role, name] of [
      ["button", "nested button"],
      ["button", "nested toggle"],
      ["combobox", "nested select"],
      ["button", "scoped button"],
      ["button", "scoped toggle"],
      ["combobox", "scoped select"],
    ] as const) {
      expect(measure(role, name).height, name).toBe(CONTROL_MD.dense.height);
    }
  });
});

describe("control size: consumer overrides", () => {
  it("lets a className size utility win on Select and on a segmented ToggleGroup item", () => {
    stampDensity("dense");
    renderThemed(
      <>
        <Select.Root>
          <Select.Trigger size="sm" aria-label="tall select" className="h-12">
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
        </Select.Root>
        <ToggleGroup.Root aria-label="wide segments" spacing={0}>
          <ToggleGroup.Item value="one" aria-label="wide segment" className="px-4">
            Label
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </>
    );
    // Tailwind's `h-12` is 3rem and `px-4` is 1rem, 48px and 16px at the 16px root. Neither
    // is a dense control metric (sm is 32px high, the md icon inset 8px).
    expect(measure("combobox", "tall select").height).toBe(48);
    expect(measure("button", "wide segment").paddingStart).toBe(16);
    expect(measure("button", "wide segment").paddingEnd).toBe(16);
  });
});
