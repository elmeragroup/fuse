import type { ReactElement, ReactNode, RefObject } from "react";

import { interpolate, useCurrentFrame } from "remotion";

import { Card } from "@elmeragroup/fuse/card";
import { Table } from "@elmeragroup/fuse/table";
import type { BrandCode, ThemeVariant } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import { currencyOf } from "../../../brand/brand-market";
import { BrandWordmark } from "../../../brand/brand-wordmark";
import { SimulatedCursor } from "../../../components/remocn/simulated-cursor";
import { useCopy } from "../../../copy/copy";
import { CLAMP, ENTER } from "../../../motion/easing";
import { beats } from "../../../music/beat-grid";
import { SceneTheme } from "../../../primitives/scene-theme";
import { useStagePoint } from "../../../primitives/stage";
import { ORDERS } from "../../../sample/customer-data";
import { OrderRows } from "../../../sample/order-rows";

/** The parts the montage opens, in order. Component names are API names, the same in every locale. */
export const MONTAGE_PARTS = ["Select", "Dialog", "Sheet", "Command", "Toast"] as const;

/** A part the montage opens. */
export type MontagePart = (typeof MONTAGE_PARTS)[number];

/**
 * Every shot's cursor clicks its trigger two beats (0.7 s) in, and the part opens on that click.
 * One beat at 172 BPM is too short a trip for the eye to follow the cursor.
 */
export const CLICK = beats(2);

/** Where the cursor enters each shot, in stage pixels: low on the right, clear of the app. */
const CURSOR_START = { x: 1060, y: 660 } as const;

/** Props for {@link MontageShot}. */
export type MontageShotProps = {
  readonly part: MontagePart;
  readonly brand: BrandCode;
  readonly scheme: ResolvedColorScheme;
  readonly variant: ThemeVariant;
  /** The control the cursor clicks; the shot measures it to aim the cursor. */
  readonly target: RefObject<HTMLElement | null>;
  /** Controls in the app's header, such as the trigger. */
  readonly actions?: ReactNode;
  /** A panel beside the orders table, such as a form. */
  readonly aside?: ReactNode;
  /** The part itself and its motion host, when they sit above the app rather than in its header. */
  readonly children?: ReactNode;
};

/**
 * One shot of the component montage: an app in one brand and scheme, the part opening over it,
 * the cursor that opens it and the row of part names with this one picked.
 *
 * @returns The shot, filling the stage.
 */
export function MontageShot({
  part,
  brand,
  scheme,
  variant,
  target,
  actions,
  aside,
  children,
}: MontageShotProps): ReactElement {
  const frame = useCurrentFrame();
  const { montage } = useCopy();
  const aim = useStagePoint(target);

  return (
    <SceneTheme
      brand={brand}
      scheme={scheme}
      variant={variant}
      className="absolute inset-0 bg-background font-sans text-foreground">
      <div
        className="rounded-2xl shadow-xl absolute top-10 left-30 flex h-140 w-255 flex-col overflow-hidden border border-border bg-card text-card-foreground"
        style={{
          scale: String(interpolate(frame, [0, 8], [0.97, 1], { ...CLAMP, easing: ENTER })),
        }}>
        <div className="flex h-16 shrink-0 items-center gap-6 border-b border-border px-6">
          <BrandWordmark brand={brand} />
          <span className="text-lg font-semibold">{montage.app}</span>
          <div className="ml-auto flex items-center gap-3">{actions}</div>
        </div>
        <div
          className={
            aside === undefined
              ? "min-h-0 flex-1 p-6"
              : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_25rem] gap-6 p-6"
          }>
          <Card.Root className="h-full overflow-hidden">
            <Card.Content className="pt-2">
              <Table.Root>
                <OrderRows orders={ORDERS} currency={currencyOf(brand)} />
              </Table.Root>
            </Card.Content>
          </Card.Root>
          {aside}
        </div>
      </div>
      {children}
      {/* Above Fuse's overlay layer, so the cursor and the part names stay on the modal's scrim. */}
      <div className="pointer-events-none absolute inset-0 z-60">
        <SimulatedCursor
          stops={[
            { ...CURSOR_START, at: 0 },
            { x: aim.x, y: aim.y, at: CLICK, click: true },
          ]}
        />
      </div>
      <ol
        className="text-lg font-medium absolute inset-x-0 bottom-7 z-60 m-0 flex list-none items-center justify-center gap-3 p-0"
        aria-label="Parts">
        {MONTAGE_PARTS.map((name) => (
          <li
            key={name}
            className={
              name === part
                ? "rounded-full bg-primary px-4 py-1 text-primary-foreground"
                : "px-2 py-1 text-muted-foreground"
            }>
            {name}
          </li>
        ))}
      </ol>
    </SceneTheme>
  );
}
