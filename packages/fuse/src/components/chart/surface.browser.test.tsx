// Unit under test: the colour a chart's cut-outs paint in each host a chart rests on, through
// `--surface` in chart.css and the hosts' recipes. Oracle: the host's own computed
// `background-color`, which the browser resolves from the host's fill class and never from the
// chart CSS, and in light themes the white every Card, `Frame.Panel`, framed Table cell, default
// Alert, bordered VerticalTable box and outline Item promises through the `panel` and `card` roles.
// A translucent host keeps the surface beneath it, so its oracle is the fill of the element around it.
//
// The interim React Aria Calendar takes no children, so no chart can rest in it. Its case reads
// the `--surface` it states and holds it to the same oracle, its own computed fill.
import type { ReactElement, ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { RowTitle } from "../../../test/selection-row";
import {
  THEMED,
  renderIn,
  restoreDocumentThemeAroundEach,
  shown,
  srgb,
  surfaceAt,
} from "../../../test/surface-paint";
import { computedContrast, stampDensity } from "../../../test/themed-browser-render";
import { Calendar as AriaCalendar } from "../../react-aria/calendar/calendar";
import { DENSITIES } from "../../theme/density";
import { Accordion } from "../accordion";
import { Alert } from "../alert/alert";
import { Calendar } from "../calendar";
import { Card } from "../card/card";
import { CheckboxCard } from "../checkbox-card/checkbox-card";
import { CheckboxGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { Dialog } from "../dialog";
import { Frame } from "../frame/frame";
import { Item } from "../item";
import { Popover } from "../popover";
import { Table, VerticalTable } from "../table/table";
import { Chart } from "./chart-namespace";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";

restoreDocumentThemeAroundEach();

const rows = [
  { month: "Jan", kwh: 1200 },
  { month: "Feb", kwh: 1400 },
  { month: "Mar", kwh: 1000 },
];

const shares = [
  { part: "energy", kr: 60 },
  { part: "grid", kr: 40 },
];

/** A line chart with default dots, whose rings are cut-outs, and a pie, whose seams are. */
function Charts(): ReactElement {
  return (
    <div style={{ width: 320 }}>
      <Chart.Root
        data={rows}
        config={{ kwh: { label: "Usage", color: "chart-1" } }}
        xKey="month"
        data-intro="none"
        aria-label="Usage per month">
        <Chart.Line dataKey="kwh" />
        <Chart.Dots dataKey="kwh" />
      </Chart.Root>
      <PieChart.Root
        data={shares}
        config={{ energy: { label: "Energy", color: "chart-1" }, grid: { label: "Grid", color: "chart-2" } }}
        nameKey="part"
        valueKey="kr"
        data-intro="none"
        aria-label="Bill">
        <PieChart.Pie />
      </PieChart.Root>
    </div>
  );
}

type Host = {
  readonly label: string;
  /** The host around a chart. */
  readonly node: (chart: ReactNode) => ReactNode;
  /** The element that paints the host's fill. */
  readonly element: () => Promise<HTMLElement>;
  /** Whether light themes promise this host white. */
  readonly whiteInLight: boolean;
  /** For a translucent host, the opaque element around it, whose fill the cut-outs paint. */
  readonly beneath?: () => Promise<HTMLElement>;
};

/** A selection row holding the chart in its SubSection. */
function OptionRow({
  chart,
  checked,
  isDisabled = false,
}: {
  chart: ReactNode;
  checked: boolean;
  isDisabled?: boolean;
}): ReactElement {
  return (
    <CheckboxGroup label="Usage options" defaultValue={checked ? ["usage"] : []}>
      <CheckboxItem value="usage" role="region" aria-label="Usage option" isDisabled={isDisabled}>
        <RowTitle>Usage</RowTitle>
        <CheckboxItem.SubSection>{chart}</CheckboxItem.SubSection>
      </CheckboxItem>
    </CheckboxGroup>
  );
}

const HOSTS: readonly Host[] = [
  {
    label: "a muted CheckboxCard",
    node: (chart) => (
      <CheckboxGroup label="Usage options">
        <CheckboxCard
          value="usage"
          title="Usage plan"
          description="Includes usage"
          variant="muted"
          rightContent={
            <div role="region" aria-label="Usage chart">
              {chart}
            </div>
          }
        />
      </CheckboxGroup>
    ),
    element: async () => {
      const chart = await shown("region", "Usage chart");
      // DOM audit: CheckboxCard takes no role or name for its card, so its slot is the only locator.
      const card = chart.closest('[data-slot="card"]');
      if (!(card instanceof HTMLElement)) throw new Error("expected Card host");
      return card;
    },
    whiteInLight: false,
  },
  {
    label: "Card",
    node: (chart) => (
      <Card.Root role="region" aria-label="Usage card">
        <Card.Content>{chart}</Card.Content>
      </Card.Root>
    ),
    element: () => shown("region", "Usage card"),
    whiteInLight: true,
  },
  {
    label: "Frame.Panel",
    node: (chart) => (
      <Frame.Root>
        <Frame.Panel role="region" aria-label="Usage panel">
          {chart}
        </Frame.Panel>
      </Frame.Root>
    ),
    element: () => shown("region", "Usage panel"),
    whiteInLight: true,
  },
  {
    // A framed Table's cells paint `panel`, so a Card around the Frame is not their surface.
    label: "a framed Table cell in a Card",
    node: (chart) => (
      <Card.Root>
        <Card.Content>
          <Frame.Root>
            <Table.Root>
              <Table.Body>
                <Table.Row>
                  <Table.Cell aria-label="Usage cell">{chart}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Frame.Root>
        </Card.Content>
      </Card.Root>
    ),
    element: () => shown("cell", "Usage cell"),
    whiteInLight: true,
  },
  {
    label: "the default Alert",
    node: (chart) => (
      <Alert.Root aria-label="Usage alert">
        <Alert.Title>Usage is up</Alert.Title>
        {chart}
      </Alert.Root>
    ),
    element: () => shown("alert", "Usage alert"),
    whiteInLight: true,
  },
  {
    label: "the warning Alert",
    node: (chart) => (
      <Alert.Root variant="warning" aria-label="Usage warning">
        <Alert.Title>Usage is high</Alert.Title>
        {chart}
      </Alert.Root>
    ),
    element: () => shown("alert", "Usage warning"),
    whiteInLight: false,
  },
  {
    label: "the info Alert",
    node: (chart) => (
      <Alert.Root variant="info" aria-label="Usage note">
        <Alert.Title>Usage is logged</Alert.Title>
        {chart}
      </Alert.Root>
    ),
    element: () => shown("alert", "Usage note"),
    whiteInLight: false,
  },
  {
    // A Card in a warning Alert paints its own fill, so it states its own surface and muted text.
    label: "a Card in the warning Alert",
    node: (chart) => (
      <Alert.Root variant="warning" aria-label="Usage warning">
        <Alert.Title>Usage is high</Alert.Title>
        <Card.Root role="region" aria-label="Usage card">
          <Card.Content>{chart}</Card.Content>
        </Card.Root>
      </Alert.Root>
    ),
    element: () => shown("region", "Usage card"),
    whiteInLight: true,
  },
  {
    // The destructive tint is translucent, so the page around the Alert stays the surface.
    label: "the destructive Alert on the page",
    node: (chart) => (
      <div role="region" aria-label="Alert page" className="bg-background">
        <Alert.Root variant="destructive" aria-label="Usage error">
          <Alert.Title>Usage failed</Alert.Title>
          {chart}
        </Alert.Root>
      </div>
    ),
    element: () => shown("alert", "Usage error"),
    whiteInLight: false,
    beneath: () => shown("region", "Alert page"),
  },
  {
    label: "the bordered VerticalTable box",
    node: (chart) => (
      <VerticalTable.Root>
        <VerticalTable.Body role="region" aria-label="Usage table">
          <VerticalTable.Row>
            <VerticalTable.Key>Usage</VerticalTable.Key>
            <VerticalTable.Value>{chart}</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    ),
    element: () => shown("region", "Usage table"),
    whiteInLight: true,
  },
  {
    label: "the outline Item",
    node: (chart) => (
      <Item.Root variant="outline" role="region" aria-label="Usage row">
        <Item.Content>{chart}</Item.Content>
      </Item.Root>
    ),
    element: () => shown("region", "Usage row"),
    whiteInLight: true,
  },
  {
    label: "an unchecked CheckboxItem",
    node: (chart) => <OptionRow chart={chart} checked={false} />,
    element: () => shown("region", "Usage option"),
    whiteInLight: true,
  },
  {
    label: "a checked CheckboxItem",
    node: (chart) => <OptionRow chart={chart} checked />,
    element: () => shown("region", "Usage option"),
    whiteInLight: false,
  },
  {
    // The disabled fill's hatch is a background image over the fill, so the cut-outs take the fill.
    label: "a disabled checked CheckboxItem",
    node: (chart) => <OptionRow chart={chart} checked isDisabled />,
    element: () => shown("region", "Usage option"),
    whiteInLight: false,
  },
  {
    // The compact VerticalTable paints no box of its own, so the Card around it stays the surface.
    label: "a Card around a compact VerticalTable",
    node: (chart) => (
      <Card.Root role="region" aria-label="Usage facts">
        <Card.Content>
          <VerticalTable.Root variant="non-bordered-compact">
            <VerticalTable.Body>
              <VerticalTable.Row>
                <VerticalTable.Key>Usage</VerticalTable.Key>
                <VerticalTable.Value>{chart}</VerticalTable.Value>
              </VerticalTable.Row>
            </VerticalTable.Body>
          </VerticalTable.Root>
        </Card.Content>
      </Card.Root>
    ),
    element: () => shown("region", "Usage facts"),
    whiteInLight: true,
  },
  {
    // A compact VerticalTable in a soft Alert inherits the Alert's surface and its muted text.
    label: "a compact VerticalTable in the info Alert",
    node: (chart) => (
      <Alert.Root variant="info" aria-label="Usage note">
        <Alert.Title>Usage is logged</Alert.Title>
        <VerticalTable.Root variant="non-bordered-compact">
          <VerticalTable.Body>
            <VerticalTable.Row>
              <VerticalTable.Key>Usage</VerticalTable.Key>
              <VerticalTable.Value>{chart}</VerticalTable.Value>
            </VerticalTable.Row>
          </VerticalTable.Body>
        </VerticalTable.Root>
      </Alert.Root>
    ),
    element: () => shown("alert", "Usage note"),
    whiteInLight: false,
  },
  {
    label: "the card Accordion",
    node: (chart) => (
      <Accordion.Root variant="card" defaultValue={["usage"]}>
        <Accordion.Item value="usage">
          <Accordion.Header>
            <Accordion.Trigger>Usage history</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>{chart}</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    ),
    element: () => shown("region", "Usage history"),
    whiteInLight: false,
  },
  {
    label: "Calendar",
    node: (chart) => <Calendar.Root aria-label="Usage calendar">{chart}</Calendar.Root>,
    element: () => shown("group", "Usage calendar"),
    whiteInLight: false,
  },
  {
    label: "Dialog",
    node: (chart) => (
      <Dialog.Root defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Usage details</Dialog.Title>
          {chart}
        </Dialog.Content>
      </Dialog.Root>
    ),
    element: () => shown("dialog", "Usage details"),
    whiteInLight: false,
  },
  {
    label: "Popover",
    node: (chart) => (
      <Popover.Root defaultOpen>
        <Popover.Trigger>Usage</Popover.Trigger>
        <Popover.Content>
          <Popover.Title>Usage preview</Popover.Title>
          {chart}
        </Popover.Content>
      </Popover.Root>
    ),
    element: () => shown("dialog", "Usage preview"),
    whiteInLight: false,
  },
  {
    // A host app paints its page `bg-background`, as the docs body does; no Fuse host states a
    // surface here, so the cut-outs fall back to the page colour.
    label: "the page",
    node: (chart) => (
      <div role="region" aria-label="Usage page" className="bg-background">
        {chart}
      </div>
    ),
    element: () => shown("region", "Usage page"),
    whiteInLight: false,
  },
];

/** The stroke of the first default dot's ring and of the first pie seam in the host, once drawn. */
async function cutOutStrokes(host: HTMLElement): Promise<{ ring: string; seam: string }> {
  // DOM audit: dots and slices are aria-hidden plot output, so their slots are the only locators.
  await expect.poll(() => host.querySelector('[data-slot="chart-dot"]')).not.toBeNull();
  await expect.poll(() => host.querySelector('[data-slot="pie-chart-sector"]')).not.toBeNull();
  const dot = host.querySelector('[data-slot="chart-dot"]');
  const sector = host.querySelector('[data-slot="pie-chart-sector"]');
  if (dot === null || sector === null) throw new Error("expected a dot and a pie slice");
  return { ring: getComputedStyle(dot).stroke, seam: getComputedStyle(sector).stroke };
}

describe("chart cut-outs", () => {
  for (const { theme, scheme, name } of THEMED) {
    it.each(HOSTS)(
      `paint the fill of $label in ${name}`,
      async ({ node, element, whiteInLight, beneath }) => {
        renderIn(theme, scheme, node(<Charts />));
        const host = await element();
        const fill = getComputedStyle(beneath === undefined ? host : await beneath()).backgroundColor;
        const { ring, seam } = await cutOutStrokes(host);
        expect(srgb(ring)).toEqual(srgb(fill));
        expect(srgb(seam)).toEqual(srgb(fill));
        if (whiteInLight && scheme === "light") expect(srgb(fill)).toEqual([1, 1, 1, 1]);
      }
    );
  }
});

describe("the React Aria Calendar", () => {
  for (const { theme, scheme, name } of THEMED) {
    it(`states its fill as --surface in ${name}`, async () => {
      renderIn(theme, scheme, <AriaCalendar aria-label="Usage days" />);
      // React Aria appends the visible month to the calendar's name.
      const calendar = page.getByRole("application", { name: /^Usage days, / });
      await expect.element(calendar).toBeInTheDocument();
      const style = getComputedStyle(calendar.element());
      expect(srgb(style.getPropertyValue("--surface"))).toEqual(srgb(style.backgroundColor));
    });
  }
});

// Unit under test: the text a chart writes on a chip or halo of its surface, the clock's and
// radar's ring values, the clock's Now label in the default and the muted tone, the value pill,
// and a reference label, in each host at both densities. Oracle: WCAG 1.4.3, 4.5:1 for these
// small labels, measured between the text colour and the colour of the chip or halo it sits on,
// as the browser computes them.
const CHIP_START = Date.parse("2025-10-26T23:00:00Z");
const CHIP_HOURS = Array.from({ length: 24 }, (_, hour) => ({
  start: CHIP_START + hour * 3_600_000,
  kwh: 1 + (hour % 4),
}));

const SPOKES = [
  { spoke: "North", kwh: 1 },
  { spoke: "East", kwh: 2 },
  { spoke: "South", kwh: 3 },
  { spoke: "West", kwh: 4 },
];

const TONES = ["default", "muted"] as const;

/** A clock with ring values, a labelled Now and a value pill, a radar with ring values, and a line with a reference label. */
function Chips({ tone }: { tone: (typeof TONES)[number] }): ReactElement {
  return (
    <div style={{ width: 320 }}>
      <ClockChart.Root
        data={CHIP_HOURS}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        xKey="start"
        cycle="day"
        interval="hour"
        now={CHIP_START + 9.5 * 3_600_000}
        data-intro="none"
        aria-label="Usage per hour">
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.RadiusAxis />
        <ClockChart.Now label="Now" tone={tone} />
        <ClockChart.Marker dataKey="kwh" at="now">
          <ClockChart.ValueLabel />
        </ClockChart.Marker>
      </ClockChart.Root>
      <RadarChart.Root
        data={SPOKES}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        nameKey="spoke"
        data-intro="none"
        aria-label="Usage per direction">
        <RadarChart.Line dataKey="kwh" />
        <RadarChart.RadiusAxis />
      </RadarChart.Root>
      <Chart.Root
        data={rows}
        config={{ kwh: { label: "Usage", color: "chart-1" } }}
        xKey="month"
        data-intro="none"
        aria-label="Usage per month">
        <Chart.Line dataKey="kwh" />
        <Chart.ReferenceLine y={1300} label="Target" />
      </Chart.Root>
    </div>
  );
}

/** The chips and the halo label, with what each one's text sits on. */
const CHIPS = [
  { slot: '[data-slot="clock-chart-radius-label"]', backdrop: "chip" },
  { slot: '[data-slot="radar-chart-radius-label"]', backdrop: "chip" },
  { slot: '[data-slot="clock-chart-now"] > [data-part="label"]', backdrop: "chip" },
  { slot: '[data-slot="clock-chart-value-label"]', backdrop: "chip" },
  { slot: '[data-slot="chart-reference-label"]', backdrop: "halo" },
] as const;

describe("chart chips", () => {
  for (const density of DENSITIES) {
    for (const tone of TONES) {
      for (const { theme, scheme, name } of THEMED) {
        it.each(HOSTS)(
          `hold their text to 4.5:1 on $label with a ${tone} Now in ${name} at ${density} density`,
          async ({ node, element }) => {
            stampDensity(density);
            renderIn(theme, scheme, node(<Chips tone={tone} />));
            const host = await element();
            for (const { slot, backdrop } of CHIPS) {
              // DOM audit: the chips are aria-hidden plot output, so their slots are the only locators.
              await expect.poll(() => host.querySelector(slot), { message: slot }).not.toBeNull();
              const chip = host.querySelector(slot);
              if (chip === null) throw new Error(`expected ${slot}`);
              const style = getComputedStyle(chip);
              const behind = backdrop === "chip" ? style.backgroundColor : surfaceAt(chip);
              expect(computedContrast(style.color, behind), slot).toBeGreaterThanOrEqual(4.5);
            }
          }
        );
      }
    }
  }
});
