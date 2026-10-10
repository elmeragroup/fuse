"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { CaretDown } from "@elmeragroup/fuse/icons";

import { useModifierLabel } from "./studio-shortcuts";
import { useStudio } from "./studio-state";
import { useViewportCommands, useViewportState, zoomLabel } from "./studio-viewport";

const studioZoomMenu = tv({
  slots: {
    value: "w-10 text-start font-mono tabular-nums",
    content: "w-60",
  },
});

const styles = studioZoomMenu();

/** The top bar's zoom menu: the zoom percentage, and every camera command with its shortcut. */
export function StudioZoomMenu(): ReactElement {
  const { selectedId } = useStudio();
  const commands = useViewportCommands();
  const { viewport } = useViewportState();
  const mod = useModifierLabel();
  const control = { animate: true, announce: true } as const;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="ghost" size="sm" />}>
        <span className="sr-only">Zoom </span>
        <span className={styles.value()}>{zoomLabel(viewport.zoom)}</span>
        <CaretDown data-icon="inline-end" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className={styles.content()}>
        <DropdownMenu.Item
          onClick={() => {
            commands.zoomStep(1, control);
          }}>
          Zoom in <DropdownMenu.Shortcut>{`${mod}+`}</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onClick={() => {
            commands.zoomStep(-1, control);
          }}>
          Zoom out <DropdownMenu.Shortcut>{`${mod}−`}</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          onClick={() => {
            commands.zoomToFit(control);
          }}>
          Zoom to fit <DropdownMenu.Shortcut>⇧1</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={selectedId === undefined}
          onClick={() => {
            if (selectedId !== undefined) {
              commands.zoomToArtboard(selectedId, control);
            }
          }}>
          Zoom to selection <DropdownMenu.Shortcut>⇧2</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onClick={() => {
            commands.zoomTo(1, control);
          }}>
          Zoom to 100% <DropdownMenu.Shortcut>{`${mod}0`}</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
