"use client";

import { memo } from "react";
import type { ReactElement, SVGProps } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Minus, Plus } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Toolbar } from "@elmeragroup/fuse/toolbar";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { ChromeScope } from "./chrome-scope";
import { CornerXrayToggle } from "./corner-xray";
import { useStudioEdits } from "./studio-edits";
import { HandGlyph, PartGlyph, PointerGlyph, RedoGlyph, UndoGlyph } from "./studio-icons";
import { usePartSelection } from "./studio-part-selection";
import { regionProps } from "./studio-regions";
import { useModifierLabel } from "./studio-shortcuts";
import { useStudio } from "./studio-state";
import type { StudioTool } from "./studio-state";
import { useViewportCommands, useViewportState, zoomLabel } from "./studio-viewport";

const studioToolbar = tv({
  slots: {
    // Toolbar.Root paints the surface; the canvas places it, floating over the artboards.
    bar: "shadow-lg absolute bottom-4 left-1/2 z-30 -translate-x-1/2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    glyph: "size-4",
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

/** The zoom readout: the one part of the bar the camera re-renders. */
function ZoomValue(): ReactElement {
  const { viewport } = useViewportState();
  return <span className={styles.value()}>{zoomLabel(viewport.zoom)}</span>;
}

/**
 * The floating bar at the foot of the canvas, as in Paper: the tools and "Select part", undo and
 * redo, and the zoom. It is a Fuse Toolbar, one Tab stop whose arrow keys move between its
 * controls. The canvas re-renders with every camera move, so the bar is memoized and only its zoom
 * readout follows the camera.
 */
export const StudioToolbar = memo(function StudioToolbar(): ReactElement {
  const { tool, setTool } = useStudio();
  const { partMode, setPartMode } = usePartSelection();
  const { edit, canUndo, canRedo } = useStudioEdits();
  const mod = useModifierLabel();
  const { zoomStep } = useViewportCommands();
  const control = { animate: true, announce: true } as const;

  return (
    <ChromeScope
      render={<Toolbar.Root aria-label="Toolbar" />}
      className={styles.bar()}
      data-canvas-overlay
      {...regionProps}>
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
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Toolbar.Button
                render={
                  <Toggle
                    size="sm"
                    aria-label="Select part"
                    pressed={partMode}
                    onPressedChange={setPartMode}
                  />
                }
              />
            }>
            <PartGlyph className={styles.glyph()} />
          </Tooltip.Trigger>
          <Tooltip.Content>Select part (P, or Alt+click)</Tooltip.Content>
        </Tooltip.Root>
        <Toolbar.Separator />
        <Toolbar.Group aria-label="History">
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Toolbar.Button
                  disabled={!canUndo}
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Undo"
                      onClick={() => {
                        edit({ type: "undo" });
                      }}
                    />
                  }
                />
              }>
              <UndoGlyph className={styles.glyph()} />
            </Tooltip.Trigger>
            <Tooltip.Content>{`Undo (${mod}Z)`}</Tooltip.Content>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Toolbar.Button
                  disabled={!canRedo}
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Redo"
                      onClick={() => {
                        edit({ type: "redo" });
                      }}
                    />
                  }
                />
              }>
              <RedoGlyph className={styles.glyph()} />
            </Tooltip.Trigger>
            <Tooltip.Content>{`Redo (⇧${mod}Z)`}</Tooltip.Content>
          </Tooltip.Root>
        </Toolbar.Group>
        <Toolbar.Separator />
        <CornerXrayToggle />
        <Toolbar.Group aria-label="Zoom">
          <Toolbar.Button
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={() => {
                  zoomStep(-1, control);
                }}
              />
            }>
            <Minus />
          </Toolbar.Button>
          <ZoomValue />
          <Toolbar.Button
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={() => {
                  zoomStep(1, control);
                }}
              />
            }>
            <Plus />
          </Toolbar.Button>
        </Toolbar.Group>
      </Tooltip.Provider>
    </ChromeScope>
  );
});
