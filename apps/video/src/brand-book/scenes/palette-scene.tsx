import type { ReactElement } from "react";

import { Interactive, useCurrentFrame } from "remotion";
import { tv } from "tailwind-variants";

import { BRANDS } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { BrandMark } from "../../brand/brand-mark";
import { roleHex } from "../../brand/role-value";
import { ValueSwap } from "../../components/remocn/value-swap";
import { useCopy } from "../../copy/copy";
import { bars, beats } from "../../music/beat-grid";
import { Rise } from "../../primitives/rise";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";
import { STAGE } from "../../primitives/stage";
import { push } from "../motion";

/** The brands in the order their panels land, Elmera first, as the landing's strip runs. */
const BRANDS_IN_ORDER = [
  "elma",
  "fkas",
  "tkas",
  "guen",
  "fkab",
  "fkse",
  "ngfi",
] as const satisfies readonly BrandCode[];

/**
 * The roles the panels resolve, each with the bar it takes over on. A role's panels fill with the
 * role and write in its foreground pair, so every label stays a gated text pair.
 */
const ROLES = [
  { role: "primary", bar: 0 },
  { role: "secondary", bar: 3 },
  { role: "feature", bar: 4 },
  { role: "primary-soft", bar: 5 },
] as const;

/** A role the palette shows. */
type PaletteRole = (typeof ROLES)[number]["role"];

/** A panel's fill and ink in each role: the role and its foreground pair. */
const panelFill = tv({
  base: "absolute inset-0 flex flex-col justify-between p-4 font-sans",
  variants: {
    role: {
      primary: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      feature: "bg-feature text-feature-foreground",
      "primary-soft": "bg-primary-soft text-primary-soft-foreground",
    } satisfies Record<PaletteRole, string>,
  },
});

/** Where the first panel lands; the ink to its left holds the role's name. */
const FIRST_PANEL_X = 340;

/** How far apart the panels land, so the last one ends at the stage's edge. */
const PANEL_STEP = (STAGE.width - FIRST_PANEL_X) / BRANDS_IN_ORDER.length;

/** Frames a panel takes to slide in, and a role's wipe to run down one panel. */
const SLIDE_FRAMES = 9;
const WIPE_FRAMES = 10;

/** Frames between neighbouring panels' wipes, so a new role sweeps left to right. */
const WIPE_STAGGER = 2;

/** One panel in one role: the brand's mark at the top, its name and the role's value below. */
function PanelFace({ brand, role }: { readonly brand: BrandCode; readonly role: PaletteRole }): ReactElement {
  return (
    <SceneTheme brand={brand} scheme="light" className={panelFill({ role })}>
      <BrandMark brand={brand} className="h-7" />
      <div className="flex flex-col gap-1" style={{ width: PANEL_STEP - 32 }}>
        <span className="text-sm font-medium leading-tight">{BRANDS[brand].displayName}</span>
        <span className="text-xs font-mono">{roleHex({ brand, scheme: "light" }, role)}</span>
      </div>
    </SceneTheme>
  );
}

/** A brand's panel: it slides in on its beat, then each new role wipes down over the last. */
function Panel({
  brand,
  index,
  frame,
}: {
  readonly brand: BrandCode;
  readonly index: number;
  readonly frame: number;
}): ReactElement {
  const slideAt = beats(index);
  const landed = push(frame, slideAt, slideAt + SLIDE_FRAMES);
  const x = FIRST_PANEL_X + index * PANEL_STEP;
  return (
    <div
      className="absolute inset-y-0 overflow-hidden"
      style={{
        left: 0,
        width: STAGE.width - x,
        translate: `${String(x + (1 - landed) * (STAGE.width - x))}px 0`,
      }}>
      {ROLES.map(({ role, bar }, layer) => {
        const wipeAt = bars(bar) + index * WIPE_STAGGER;
        const shown = layer === 0 ? 1 : push(frame, wipeAt, wipeAt + WIPE_FRAMES);
        return shown <= 0 ? null : (
          <div
            key={role}
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 ${String((1 - shown) * 100)}% 0)` }}>
            <PanelFace brand={brand} role={role} />
          </div>
        );
      })}
    </div>
  );
}

/** The bar the palette pushes left and the anatomy's page pushes in from the right. */
const EXIT_BAR = 6.25;

/** Frames the push takes. */
const EXIT_FRAMES = beats(3);

function PaletteSceneInner(): ReactElement {
  const { palette } = useCopy().brandBook;
  const frame = useCurrentFrame();
  const leaving = push(frame, bars(EXIT_BAR), bars(EXIT_BAR) + EXIT_FRAMES);
  const roleNames = ROLES.map(({ role }) => `--${role}`);

  return (
    <SceneFrame>
      <div className="relative size-full overflow-hidden">
        {/* The ink, the panels and the next page are siblings, never nested: Fuse's dark scheme
            reaches every scope inside a dark one, so a light panel inside the ink would turn dark. */}
        <div className="absolute inset-0" style={{ translate: `${String(-leaving * STAGE.width)}px 0` }}>
          <SceneTheme
            brand="elma"
            scheme="dark"
            className="absolute inset-0 bg-background font-sans text-foreground">
            <div
              className="absolute top-0 left-12 flex h-full flex-col justify-center gap-3"
              style={{ width: FIRST_PANEL_X - 72 }}>
              <Rise at={0}>
                <span className="font-mono text-[30px] leading-none">
                  <ValueSwap values={roleNames} at={ROLES.slice(1).map(({ bar }) => bars(bar))} />
                </span>
              </Rise>
              <Rise at={beats(2)}>
                <p className="text-base m-0 text-muted-foreground">{palette.caption}</p>
              </Rise>
            </div>
          </SceneTheme>
          {BRANDS_IN_ORDER.map((brand, index) => (
            <Panel key={brand} brand={brand} index={index} frame={frame} />
          ))}
          {/* The anatomy's page, already in place to the right, so the push hands over without a cut. */}
          <div className="absolute inset-y-0" style={{ left: STAGE.width, width: STAGE.width }}>
            <SceneTheme brand="elma" scheme="light" className="size-full bg-background">
              {null}
            </SceneTheme>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

/**
 * Scene 2: the palette. Seven brand panels slide in on the drums, each filled with its brand's
 * primary role, then every role after it sweeps across all seven at once: one role name, seven
 * brand values.
 */
export const PaletteScene = Interactive.withSchema({
  Component: PaletteSceneInner,
  componentName: "PaletteScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
