"use client";

import type { ReactElement, SVGProps } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Minus, Plus } from "@elmeragroup/fuse/icons";
import { Separator } from "@elmeragroup/fuse/separator";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { ChromeScope } from "./chrome-scope";
import { HandGlyph, PointerGlyph } from "./studio-icons";
import { useStudio } from "./studio-state";
import type { StudioTool } from "./studio-state";
import { useViewportCommands, useViewportState, zoomLabel } from "./studio-viewport";

const studioToolbar = tv({
  slots: {
    bar: "shadow-lg absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-popover p-1 text-popover-foreground",
    glyph: "size-4",
    separator: "h-5",
    value: "text-xs w-12 text-center font-mono tabular-nums",
  },
});

const styles = studioToolbar();

const TOOLS = [
  { value: "select", label: "Select", key: "V", Glyph: PointerGlyph },
  { value: "hand", label: "Hand", key: "H", Glyph: HandGlyph },
] as const satisfies readonly {
  value: StudioTool;
  label: string;
  key: string;
  Glyph: (props: SVGProps<SVGSVGElement>) => ReactElement;
}[];

/** The floating bar at the foot of the canvas, as in Paper: the tools and the zoom. */
export function StudioToolbar(): ReactElement {
  const { tool, setTool } = useStudio();
  const { zoomStep } = useViewportCommands();
  const { viewport } = useViewportState();
  const control = { animate: true, announce: true } as const;

  return (
    <ChromeScope className={styles.bar()} data-canvas-overlay>
      <Tooltip.Provider>
        <ToggleGroup.Root
          aria-label="Tool"
          size="sm"
          value={[tool]}
          onValueChange={(next) => {
            const picked = TOOLS.find((entry) => entry.value === next[0]);
            if (picked !== undefined) {
              setTool(picked.value);
            }
          }}>
          {TOOLS.map(({ value, label, key, Glyph }) => (
            <Tooltip.Root key={value}>
              <Tooltip.Trigger render={<ToggleGroup.Item value={value} aria-label={label} />}>
                <Glyph className={styles.glyph()} />
              </Tooltip.Trigger>
              <Tooltip.Content>{`${label} (${key})`}</Tooltip.Content>
            </Tooltip.Root>
          ))}
        </ToggleGroup.Root>
        <Separator orientation="vertical" className={styles.separator()} />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => {
            zoomStep(-1, control);
          }}>
          <Minus />
        </Button>
        <span className={styles.value()}>{zoomLabel(viewport.zoom)}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => {
            zoomStep(1, control);
          }}>
          <Plus />
        </Button>
      </Tooltip.Provider>
    </ChromeScope>
  );
}
