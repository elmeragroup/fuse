import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { Interactive, interpolate, useVideoConfig } from "remotion";

import { DEFAULT_VERSION } from "../../brand/fuse-facts";
import { CLAMP, ENTER } from "../../motion/easing";
import { useFrameClock } from "../../motion/frame-clock";
import type { FrameClock } from "../../motion/frame-clock";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";
import {
  BACK_DEPTH,
  ENTRY_FRAMES,
  ENTRY_TRAVEL,
  LANES,
  overlayWindow,
  PAINT_ORDER,
  stack,
  WORLD,
} from "./collage/collage-layout";
import type { LaneName, PlateSlot } from "./collage/collage-layout";
import {
  AccordionTile,
  AlertTile,
  BadgeTile,
  CodeTile,
  DescriptionListTile,
  EmptyTile,
  IllustrationTile,
  PeopleTile,
  SearchTile,
  TableTile,
  TabsTile,
  TimelineTile,
  TypeTile,
} from "./collage/data-tiles";
import { BudgetTile, CalendarTile, ChoicesTile, FormTile } from "./collage/form-tiles";
import { CommandTile, SidebarTile } from "./collage/nav-tiles";
import {
  ComboboxTile,
  DialogTile,
  DropdownMenuTile,
  PopoverTile,
  SelectTile,
  ToastTile,
  ToolbarTile,
} from "./collage/overlay-tiles";
import { ComponentPlate, PlateMotionContext } from "./collage/plate";
import type { PlateTheme } from "./collage/plate";
import { HeadlinePoster, MarkPoster, SwatchPoster } from "./collage/posters";

/** One plate: its height in its lane and what it shows. */
type PlateEntry = {
  readonly key: string;
  readonly height: number;
  readonly content: ReactNode;
};

/** A lane's plates top to bottom, and the top of its first plate when its stack lands. */
type LaneContent = {
  readonly top: number;
  readonly plates: readonly PlateEntry[];
};

/** A component plate entry. */
function plate(key: string, height: number, name: string, theme: PlateTheme, part: ReactElement): PlateEntry {
  return {
    key,
    height,
    content: (
      <ComponentPlate name={name} theme={theme}>
        {part}
      </ComponentPlate>
    ),
  };
}

/**
 * Every lane's plates. Up lanes start near the sheet's top and stack down past its bottom, so their
 * later plates rise into view; down lanes stack up past the top and sink into view. Every brand
 * appears in components and posters alike, in both schemes.
 *
 * @param version - The release the posters name.
 * @returns The plates per lane.
 */
function lanes(version: string) {
  return {
    left: {
      top: -560,
      plates: [
        { key: "mark-fkab", height: 250, content: <MarkPoster brand="fkab" /> },
        {
          key: "poster-elma",
          height: 320,
          content: <HeadlinePoster brand="elma" version={version} line="roles" />,
        },
        { key: "mark-ngfi", height: 250, content: <MarkPoster brand="ngfi" /> },
        { key: "swatch-fkse", height: 280, content: <SwatchPoster brand="fkse" /> },
      ],
    },
    a: {
      top: 30,
      plates: [
        plate("calendar", 360, "Calendar", { brand: "fkas", scheme: "light" }, <CalendarTile />),
        plate("toast", 170, "Toast", { brand: "ngfi", scheme: "light" }, <ToastTile />),
        plate(
          "sidebar",
          300,
          "Sidebar",
          { brand: "elma", scheme: "light", variant: "internal" },
          <SidebarTile />
        ),
        plate("alert", 170, "Alert", { brand: "guen", scheme: "dark" }, <AlertTile />),
        plate(
          "details",
          290,
          "DescriptionList · Breadcrumb",
          { brand: "fkse", scheme: "dark" },
          <DescriptionListTile />
        ),
        plate("timeline", 290, "TimelineList", { brand: "fkab", scheme: "light" }, <TimelineTile />),
      ],
    },
    b: {
      top: -660,
      plates: [
        {
          key: "poster-fkas",
          height: 320,
          content: <HeadlinePoster brand="fkas" version={version} line="components" />,
        },
        plate("menu", 300, "DropdownMenu", { brand: "guen", scheme: "light" }, <DropdownMenuTile />),
        plate("toolbar", 170, "Toolbar · Tooltip", { brand: "fkas", scheme: "light" }, <ToolbarTile />),
        plate(
          "choices",
          360,
          "RadioGroup · CheckboxCard",
          { brand: "tkas", scheme: "light" },
          <ChoicesTile />
        ),
        plate("badges", 180, "Badge · ButtonGroup", { brand: "tkas", scheme: "light" }, <BadgeTile />),
      ],
    },
    c: {
      top: 40,
      plates: [
        plate(
          "table",
          340,
          "Table · Pagination",
          { brand: "guen", scheme: "light", variant: "internal" },
          <TableTile />
        ),
        plate(
          "command",
          320,
          "Command",
          { brand: "elma", scheme: "dark", variant: "internal" },
          <CommandTile />
        ),
        plate("dialog", 290, "Dialog", { brand: "tkas", scheme: "dark" }, <DialogTile />),
        plate("form", 360, "PhoneNumberField · Switch", { brand: "fkse", scheme: "dark" }, <FormTile />),
        plate("type", 260, "Heading · Text", { brand: "ngfi", scheme: "light" }, <TypeTile />),
        plate("empty", 260, "Empty", { brand: "elma", scheme: "dark" }, <EmptyTile />),
      ],
    },
    d: {
      top: -600,
      plates: [
        { key: "mark-fkse", height: 240, content: <MarkPoster brand="fkse" /> },
        plate("budget", 250, "Slider · Meter", { brand: "fkab", scheme: "dark" }, <BudgetTile />),
        plate("illustration", 270, "FkasMeter", { brand: "fkas", scheme: "light" }, <IllustrationTile />),
        plate("people", 280, "Item · Avatar", { brand: "tkas", scheme: "dark" }, <PeopleTile />),
        plate("search", 180, "InputGroup · Kbd", { brand: "ngfi", scheme: "light" }, <SearchTile />),
      ],
    },
    e: {
      top: 20,
      plates: [
        plate("accordion", 290, "Accordion", { brand: "ngfi", scheme: "light" }, <AccordionTile />),
        plate("select", 310, "Select", { brand: "fkab", scheme: "light" }, <SelectTile />),
        plate("combobox", 310, "Combobox", { brand: "tkas", scheme: "light" }, <ComboboxTile />),
        plate("popover", 260, "Popover", { brand: "ngfi", scheme: "dark" }, <PopoverTile />),
        plate("tabs", 270, "Tabs · ToggleGroup", { brand: "fkas", scheme: "dark" }, <TabsTile />),
        plate(
          "code",
          180,
          "Code · Kbd",
          { brand: "elma", scheme: "dark", variant: "internal" },
          <CodeTile />
        ),
      ],
    },
    right: {
      top: -500,
      plates: [
        { key: "swatch-tkas", height: 280, content: <SwatchPoster brand="tkas" /> },
        { key: "mark-guen", height: 250, content: <MarkPoster brand="guen" /> },
        {
          key: "poster-ngfi",
          height: 320,
          content: <HeadlinePoster brand="ngfi" version={version} line="components" />,
        },
        { key: "mark-elma", height: 250, content: <MarkPoster brand="elma" /> },
      ],
    },
  } satisfies Record<LaneName, LaneContent>;
}

/** Plates further than this outside the sheet are not mounted, in world pixels. */
const CULL_MARGIN = 120;

/** One plate in its slot at a frame, or nothing while it is off the sheet. */
function PlateAt({
  slot,
  clock,
  durationInFrames,
  children,
}: {
  readonly slot: PlateSlot;
  readonly clock: FrameClock;
  readonly durationInFrames: number;
  readonly children: ReactNode;
}): ReactElement | null {
  const { frame } = clock;
  const lane = LANES[slot.lane];
  // The stacks land on the drop: they start fast and settle, where the template's push eases in.
  const entered = interpolate(frame, [lane.delay, lane.delay + ENTRY_FRAMES], [0, 1], {
    ...CLAMP,
    easing: ENTER,
  });
  // Up lanes push in from below the sheet and down lanes from above it, then drift on.
  const from = lane.velocity < 0 ? ENTRY_TRAVEL : -ENTRY_TRAVEL;
  const top = slot.top + lane.velocity * frame + (1 - entered) * from;
  if (top > WORLD.height + CULL_MARGIN || top + slot.height < -CULL_MARGIN) {
    return null;
  }
  const back = lane.depth === "back";
  return (
    <div
      className="shadow-lg absolute overflow-hidden"
      style={{
        left: lane.x,
        top: 0,
        width: lane.width,
        height: slot.height,
        translate: `0 ${String(top)}px`,
        scale: back ? String(BACK_DEPTH.scale) : undefined,
        filter: back ? `blur(${String(BACK_DEPTH.blur)}px)` : undefined,
      }}>
      <PlateMotionContext value={{ clock, window: overlayWindow(slot, durationInFrames) }}>
        {children}
      </PlateMotionContext>
    </div>
  );
}

/** The release every poster names; the composition's version prop sets it. */
type CollageProps = {
  readonly version: string;
};

function CollageSceneInner({ version }: CollageProps): ReactElement {
  const clock = useFrameClock();
  const { frame } = clock;
  const { durationInFrames } = useVideoConfig();
  const layout = useMemo(() => lanes(version), [version]);

  return (
    <SceneFrame>
      <SceneTheme brand="elma" scheme="light" className="relative size-full overflow-hidden bg-background">
        {/* The template's slow push-in over the whole collage. */}
        <div
          className="absolute inset-0"
          style={{ scale: String(interpolate(frame, [0, durationInFrames], [1, 1.045], CLAMP)) }}>
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: WORLD.width, height: WORLD.height, scale: String(WORLD.scale) }}>
            {PAINT_ORDER.map((name) => {
              const { top, plates } = layout[name];
              const slots = stack(
                name,
                top,
                plates.map((entry) => entry.height)
              );
              return plates.map((entry, index) => {
                const slot = slots[index];
                return slot === undefined ? null : (
                  <PlateAt key={entry.key} slot={slot} clock={clock} durationInFrames={durationInFrames}>
                    {entry.content}
                  </PlateAt>
                );
              });
            })}
          </div>
        </div>
      </SceneTheme>
    </SceneFrame>
  );
}

/**
 * Scene 4: the collage, on the track's drop. Live Fuse parts on plates in every brand and both
 * schemes, with brand posters between them, push in as seven stacks and travel at their own speeds
 * in two depths, as the template's photographs and posters do.
 */
export const CollageScene = Interactive.withSchema({
  Component: CollageSceneInner,
  componentName: "CollageScene",
  schema: {
    version: { type: "string", default: DEFAULT_VERSION, description: "Version" },
  },
  wrapInSequence: true,
  layout: "absolute-fill",
});
