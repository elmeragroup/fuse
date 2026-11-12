// The hosts a part can rest on, each stating its fill as `--surface`, inheriting the one beneath
// it or, on the page, stating none, for suites that hold a part's paint to the fill of the host
// around it. Each host's own computed `background-color` is the oracle: the browser resolves it
// from the host's fill class, never from the part under test.
import type { ReactElement, ReactNode } from "react";

import { Accordion } from "../src/components/accordion";
import { Alert } from "../src/components/alert/alert";
import { Calendar } from "../src/components/calendar";
import { Card } from "../src/components/card/card";
import { CheckboxCard } from "../src/components/checkbox-card/checkbox-card";
import { CheckboxGroup } from "../src/components/checkbox/checkbox";
import { CheckboxItem } from "../src/components/checkbox/checkbox-item";
import { Dialog } from "../src/components/dialog";
import { Frame } from "../src/components/frame/frame";
import { Item } from "../src/components/item";
import { Popover } from "../src/components/popover";
import { Table, VerticalTable } from "../src/components/table/table";
import type { ResolvedColorScheme } from "../src/theme/color-scheme-types";
import type { ThemeInput } from "../src/theme/theme-input";
import { RowTitle } from "./selection-row";
import { renderIn, shown } from "./surface-paint";

/** One host a part can rest on. */
export type SurfaceHost = {
  /** The host's name in test titles, and the name a suite selects it by. */
  readonly label: string;
  /** The host with the part under test inside it. */
  readonly node: (part: ReactNode) => ReactNode;
  /** The element that paints the host's fill. */
  readonly element: () => Promise<HTMLElement>;
  /** Whether light themes promise this host white. */
  readonly whiteInLight: boolean;
  /** For a translucent host, the opaque element around it, whose fill the cut-outs paint. */
  readonly beneath?: () => Promise<HTMLElement>;
};

/** A selection row holding the part in its SubSection. */
function OptionRow({
  part,
  checked,
  isDisabled = false,
}: {
  part: ReactNode;
  checked: boolean;
  isDisabled?: boolean;
}): ReactElement {
  return (
    <CheckboxGroup label="Usage options" defaultValue={checked ? ["usage"] : []}>
      <CheckboxItem value="usage" role="region" aria-label="Usage option" isDisabled={isDisabled}>
        <RowTitle>Usage</RowTitle>
        <CheckboxItem.SubSection>{part}</CheckboxItem.SubSection>
      </CheckboxItem>
    </CheckboxGroup>
  );
}

const HOSTS = [
  {
    label: "a muted CheckboxCard",
    node: (part) => (
      <CheckboxGroup label="Usage options">
        <CheckboxCard
          value="usage"
          title="Usage plan"
          description="Includes usage"
          variant="muted"
          rightContent={
            <div role="region" aria-label="Usage chart">
              {part}
            </div>
          }
        />
      </CheckboxGroup>
    ),
    element: async () => {
      const part = await shown("region", "Usage chart");
      // DOM audit: CheckboxCard takes no role or name for its card, so its slot is the only locator.
      const card = part.closest('[data-slot="card"]');
      if (!(card instanceof HTMLElement)) throw new Error("expected Card host");
      return card;
    },
    whiteInLight: false,
  },
  {
    label: "Card",
    node: (part) => (
      <Card.Root role="region" aria-label="Usage card">
        <Card.Content>{part}</Card.Content>
      </Card.Root>
    ),
    element: () => shown("region", "Usage card"),
    whiteInLight: true,
  },
  {
    label: "Frame.Panel",
    node: (part) => (
      <Frame.Root>
        <Frame.Panel role="region" aria-label="Usage panel">
          {part}
        </Frame.Panel>
      </Frame.Root>
    ),
    element: () => shown("region", "Usage panel"),
    whiteInLight: true,
  },
  {
    // A framed Table's cells paint `panel`, so a Card around the Frame is not their surface.
    label: "a framed Table cell in a Card",
    node: (part) => (
      <Card.Root>
        <Card.Content>
          <Frame.Root>
            <Table.Root>
              <Table.Body>
                <Table.Row>
                  <Table.Cell aria-label="Usage cell">{part}</Table.Cell>
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
    node: (part) => (
      <Alert.Root aria-label="Usage alert">
        <Alert.Title>Usage is up</Alert.Title>
        {part}
      </Alert.Root>
    ),
    element: () => shown("alert", "Usage alert"),
    whiteInLight: true,
  },
  {
    label: "the warning Alert",
    node: (part) => (
      <Alert.Root variant="warning" aria-label="Usage warning">
        <Alert.Title>Usage is high</Alert.Title>
        {part}
      </Alert.Root>
    ),
    element: () => shown("alert", "Usage warning"),
    whiteInLight: false,
  },
  {
    label: "the info Alert",
    node: (part) => (
      <Alert.Root variant="info" aria-label="Usage note">
        <Alert.Title>Usage is logged</Alert.Title>
        {part}
      </Alert.Root>
    ),
    element: () => shown("alert", "Usage note"),
    whiteInLight: false,
  },
  {
    // A Card in a warning Alert paints its own fill, so it states its own surface and muted text.
    label: "a Card in the warning Alert",
    node: (part) => (
      <Alert.Root variant="warning" aria-label="Usage warning">
        <Alert.Title>Usage is high</Alert.Title>
        <Card.Root role="region" aria-label="Usage card">
          <Card.Content>{part}</Card.Content>
        </Card.Root>
      </Alert.Root>
    ),
    element: () => shown("region", "Usage card"),
    whiteInLight: true,
  },
  {
    // The destructive tint is translucent, so the page around the Alert stays the surface.
    label: "the destructive Alert on the page",
    node: (part) => (
      <div role="region" aria-label="Alert page" className="bg-background">
        <Alert.Root variant="destructive" aria-label="Usage error">
          <Alert.Title>Usage failed</Alert.Title>
          {part}
        </Alert.Root>
      </div>
    ),
    element: () => shown("alert", "Usage error"),
    whiteInLight: false,
    beneath: () => shown("region", "Alert page"),
  },
  {
    label: "the bordered VerticalTable box",
    node: (part) => (
      <VerticalTable.Root>
        <VerticalTable.Body role="region" aria-label="Usage table">
          <VerticalTable.Row>
            <VerticalTable.Key>Usage</VerticalTable.Key>
            <VerticalTable.Value>{part}</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    ),
    element: () => shown("region", "Usage table"),
    whiteInLight: true,
  },
  {
    label: "the outline Item",
    node: (part) => (
      <Item.Root variant="outline" role="region" aria-label="Usage row">
        <Item.Content>{part}</Item.Content>
      </Item.Root>
    ),
    element: () => shown("region", "Usage row"),
    whiteInLight: true,
  },
  {
    label: "an unchecked CheckboxItem",
    node: (part) => <OptionRow part={part} checked={false} />,
    element: () => shown("region", "Usage option"),
    whiteInLight: true,
  },
  {
    label: "a checked CheckboxItem",
    node: (part) => <OptionRow part={part} checked />,
    element: () => shown("region", "Usage option"),
    whiteInLight: false,
  },
  {
    // The disabled fill's hatch is a background image over the fill, so the cut-outs take the fill.
    label: "a disabled checked CheckboxItem",
    node: (part) => <OptionRow part={part} checked isDisabled />,
    element: () => shown("region", "Usage option"),
    whiteInLight: false,
  },
  {
    // The compact VerticalTable paints no box of its own, so the Card around it stays the surface.
    label: "a Card around a compact VerticalTable",
    node: (part) => (
      <Card.Root role="region" aria-label="Usage facts">
        <Card.Content>
          <VerticalTable.Root variant="non-bordered-compact">
            <VerticalTable.Body>
              <VerticalTable.Row>
                <VerticalTable.Key>Usage</VerticalTable.Key>
                <VerticalTable.Value>{part}</VerticalTable.Value>
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
    node: (part) => (
      <Alert.Root variant="info" aria-label="Usage note">
        <Alert.Title>Usage is logged</Alert.Title>
        <VerticalTable.Root variant="non-bordered-compact">
          <VerticalTable.Body>
            <VerticalTable.Row>
              <VerticalTable.Key>Usage</VerticalTable.Key>
              <VerticalTable.Value>{part}</VerticalTable.Value>
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
    node: (part) => (
      <Accordion.Root variant="card" defaultValue={["usage"]}>
        <Accordion.Item value="usage">
          <Accordion.Header>
            <Accordion.Trigger>Usage history</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>{part}</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    ),
    element: () => shown("region", "Usage history"),
    whiteInLight: false,
  },
  {
    label: "Calendar",
    node: (part) => <Calendar.Root aria-label="Usage calendar">{part}</Calendar.Root>,
    element: () => shown("group", "Usage calendar"),
    whiteInLight: false,
  },
  {
    label: "Dialog",
    node: (part) => (
      <Dialog.Root defaultOpen>
        {/* The Dialog leaves focus where it is, so a part inside it starts unfocused, as in every
            other host, and a suite reads its hover and focus states apart. */}
        <Dialog.Content initialFocus={false}>
          <Dialog.Title>Usage details</Dialog.Title>
          {part}
        </Dialog.Content>
      </Dialog.Root>
    ),
    element: () => shown("dialog", "Usage details"),
    whiteInLight: false,
  },
  {
    label: "Popover",
    node: (part) => (
      <Popover.Root defaultOpen>
        <Popover.Trigger>Usage</Popover.Trigger>
        <Popover.Content>
          <Popover.Title>Usage preview</Popover.Title>
          {part}
        </Popover.Content>
      </Popover.Root>
    ),
    element: () => shown("dialog", "Usage preview"),
    whiteInLight: false,
  },
  {
    // A host app paints its page `bg-background`, as the docs body does; no Fuse host states a
    // surface here, so readers fall back to the page colour.
    label: "the page",
    node: (part) => (
      <div role="region" aria-label="Usage page" className="bg-background">
        {part}
      </div>
    ),
    element: () => shown("region", "Usage page"),
    whiteInLight: false,
  },
] as const satisfies readonly SurfaceHost[];

/** Every Fuse host that states `--surface`, the translucent hosts that inherit one, and the page, which states none. */
export const SURFACE_HOSTS: readonly SurfaceHost[] = HOSTS;

/** The name of one host in `SURFACE_HOSTS`. */
type SurfaceHostLabel = (typeof HOSTS)[number]["label"];

/**
 * Select hosts by name, for a suite that holds a part to a few hosts rather than every one, so a
 * host added for another part does not grow it.
 *
 * @param labels - The hosts to select, in the order the suite runs them.
 * @returns The named hosts.
 */
export function surfaceHostsNamed(labels: readonly SurfaceHostLabel[]): readonly SurfaceHost[] {
  return labels.map((label) => {
    const host = HOSTS.find((candidate) => candidate.label === label);
    // `SurfaceHostLabel` is derived from `HOSTS`, so every label names a host.
    if (host === undefined) throw new Error(`no surface host is labelled ${label}`);
    return host;
  });
}

/**
 * Render a part inside a host under a theme and scheme. The suite restores the document theme
 * through `restoreDocumentThemeAroundEach`.
 *
 * @returns The element that paints the host's fill, once it is shown.
 */
export function renderInHost(
  host: SurfaceHost,
  theme: ThemeInput,
  scheme: ResolvedColorScheme,
  part: ReactElement
): Promise<HTMLElement> {
  renderIn(theme, scheme, host.node(part));
  return host.element();
}
