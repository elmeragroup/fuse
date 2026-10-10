"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { buttonVariants } from "@elmeragroup/fuse/button";
import { Toggle } from "@elmeragroup/fuse/toggle";

import { STUDIO_PAGES } from "../lib/pages";
import { StudioPanelSection } from "./studio-panel-section";
import { useStudio } from "./studio-state";
import { useViewportCommands } from "./studio-viewport";

const studioNavigator = tv({
  slots: {
    // Layout only: the scroll area sizes its content to fit, so a long artboard name would widen
    // the panel; containment holds the rows to its width, where the names truncate.
    list: "m-0 flex list-none flex-col gap-0.5 p-0 contain-inline-size",
    // A full-width row, its name from the start edge, like Figma's layers list.
    row: "w-full justify-start",
    name: "truncate",
  },
});

const styles = studioNavigator();

/**
 * The left panel: the studio's pages, then the current page's artboards. A layer selects its
 * artboard, glides the canvas to it and moves focus into it, so a keyboard user reaches every
 * artboard from here and Tab continues through its content. Hovering a layer highlights its
 * artboard. `onPick`, when given, takes the artboard to focus instead, so the phone's Sheet can
 * close and hand focus to it.
 */
export function StudioNavigator({
  onPick,
}: {
  onPick?: (artboard: HTMLElement | undefined) => void;
}): ReactElement {
  const pathname = usePathname();
  const { artboards, selectedId, select, hover } = useStudio();
  const { zoomToArtboard, artboardElement } = useViewportCommands();

  return (
    <>
      <StudioPanelSection title="Pages">
        <ul className={styles.list()}>
          {STUDIO_PAGES.map((page) => {
            const current = page.href === pathname;
            return (
              <li key={page.href}>
                {/* A link in the Button's look: Button would announce page navigation as a button. */}
                <Link
                  href={page.href}
                  className={buttonVariants({
                    variant: current ? "secondary" : "ghost",
                    size: "sm",
                    className: styles.row(),
                  })}
                  aria-current={current ? "page" : undefined}>
                  <span className={styles.name()}>{page.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </StudioPanelSection>
      <StudioPanelSection title="Layers">
        <ul className={styles.list()}>
          {artboards.map((artboard) => (
            <li key={artboard.id}>
              <Toggle
                size="sm"
                className={styles.row()}
                pressed={artboard.id === selectedId}
                onPointerEnter={() => {
                  hover(artboard.id);
                }}
                onPointerLeave={() => {
                  hover(undefined);
                }}
                onFocus={() => {
                  hover(artboard.id);
                }}
                onBlur={() => {
                  hover(undefined);
                }}
                onClick={() => {
                  select(artboard.id);
                  zoomToArtboard(artboard.id, { animate: true, announce: true });
                  const board = artboardElement(artboard.id);
                  if (onPick === undefined) {
                    board?.focus({ preventScroll: true });
                  } else {
                    onPick(board);
                  }
                }}>
                <span className={styles.name()}>{artboard.name}</span>
              </Toggle>
            </li>
          ))}
        </ul>
      </StudioPanelSection>
    </>
  );
}
