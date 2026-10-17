import type { ReactElement } from "react";

import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { Table } from "@elmeragroup/fuse/table";
import { TextField } from "@elmeragroup/fuse/text-field";
import { defaultDensityForVariant } from "@elmeragroup/fuse/theme";
import type { ThemeVariant } from "@elmeragroup/fuse/theme";

import { currencyOf } from "../../brand/brand-market";
import { mediumControlPx } from "../../brand/fuse-catalog";
import { useCopy, useVideoLocale } from "../../copy/copy";
import { formatDay } from "../../copy/format-day";
import { CLAMP, ENTER } from "../../motion/easing";
import { beats } from "../../music/beat-grid";
import { Rise } from "../../primitives/rise";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";
import { METER_NUMBER, ORDERS, READING_KWH } from "../../sample/customer-data";
import { OrderRows } from "../../sample/order-rows";

/** The brand both panels show; its market sets the orders' currency. */
const BRAND = "elma";

/** The panel's caption: the audience, then the `data-density` the variant deploys and its control height. */
function PanelLabel({ variant }: { readonly variant: ThemeVariant }): ReactElement {
  const { density: copy } = useCopy();
  const density = defaultDensityForVariant(variant);
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-base font-semibold">{copy[variant]}</span>
      <span className="text-sm font-mono text-muted-foreground">
        data-density="{density}" · {copy.controls(mediumControlPx(density))}
      </span>
    </div>
  );
}

function OrdersPanel(): ReactElement {
  const { density: copy } = useCopy();
  return (
    <Card.Root className="h-110 overflow-hidden">
      <Card.Header>
        <Card.Title>{copy.table.title}</Card.Title>
      </Card.Header>
      <Card.Content>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>{copy.table.customer}</Table.Head>
              <Table.Head>{copy.table.status}</Table.Head>
              <Table.Head className="text-right">{copy.table.amount}</Table.Head>
            </Table.Row>
          </Table.Header>
          <OrderRows orders={ORDERS} currency={currencyOf(BRAND)} />
        </Table.Root>
      </Card.Content>
    </Card.Root>
  );
}

function ReadingPanel(): ReactElement {
  const { density: copy } = useCopy();
  const date = formatDay(useVideoLocale(), Date.UTC(2026, 9, 2));
  return (
    <Card.Root className="h-110">
      <Card.Header>
        <Card.Title>{copy.form.title}</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <TextField label={copy.form.meter} defaultValue={METER_NUMBER} />
        <div className="grid grid-cols-2 gap-4">
          <NumberField label={copy.form.reading} denomination="kWh" defaultValue={READING_KWH} />
          <TextField label={copy.form.date} defaultValue={date} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button>{copy.form.save}</Button>
          <Button variant="ghost">{copy.form.cancel}</Button>
        </div>
      </Card.Content>
    </Card.Root>
  );
}

function DensitySceneInner(): ReactElement {
  const { density: copy } = useCopy();
  const frame = useCurrentFrame();
  const end = useVideoConfig().durationInFrames;
  const leave = interpolate(frame, [end - beats(1), end], [1, 0], CLAMP);
  const arrive = (at: number) => interpolate(frame, [at, at + beats(2)], [0, 1], { ...CLAMP, easing: ENTER });
  const internal = arrive(beats(2));
  const external = arrive(beats(3));

  return (
    <SceneFrame>
      <SceneTheme
        brand={BRAND}
        scheme="light"
        className="relative flex size-full flex-col items-center gap-9 bg-background px-20 pt-14 font-sans text-foreground">
        <Rise at={0} exitAt={end - beats(1)} className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm m-0 font-mono tracking-[0.12em] text-secondary">data-density</p>
          <h2 className="leading-tight font-semibold m-0 font-heading text-[44px] tracking-[-0.03em]">
            {copy.title}
          </h2>
        </Rise>
        <div className="grid w-full grid-cols-2 gap-8">
          <div
            className="flex flex-col gap-3"
            style={{
              opacity: internal * leave,
              translate: `${String((1 - internal) * -80)}px 0`,
            }}>
            <SceneTheme
              brand={BRAND}
              scheme="light"
              variant="internal"
              className="flex flex-col gap-3 bg-transparent">
              <PanelLabel variant="internal" />
              <OrdersPanel />
            </SceneTheme>
          </div>
          <div
            className="flex flex-col gap-3"
            style={{
              opacity: external * leave,
              translate: `${String((1 - external) * 80)}px 0`,
            }}>
            <PanelLabel variant="external" />
            <ReadingPanel />
          </div>
        </div>
      </SceneTheme>
    </SceneFrame>
  );
}

/** Scene 3: a dense internal app beside a comfortable customer page, in one frame. */
export const DensityScene = Interactive.withSchema({
  Component: DensitySceneInner,
  componentName: "DensityScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
