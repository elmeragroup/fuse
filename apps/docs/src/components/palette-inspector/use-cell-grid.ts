"use client";

import { useLayoutEffect, useRef } from "react";
import type { FocusEvent, KeyboardEvent, RefObject } from "react";

/** A cell trigger: the focusable element a grid cell holds, a button or a pinned cell. */
const CELL = "[data-grid-cell]";

/** The custom property that holds the sticky header's rendered height, for the scroll padding. */
const HEADER_HEIGHT = "--grid-header-height";

/** The attribute that outlines the cells holding the color under the pointer or focus. */
const SAME_TONE = "data-same-tone";

function cellOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>(CELL) : null;
}

/** The trigger in a row's cell at `index`, if that cell holds one. */
function triggerAt(row: Element | null, index: number): HTMLElement | null {
  if (!(row instanceof HTMLTableRowElement)) {
    return null;
  }
  return row.cells[index]?.querySelector<HTMLElement>(CELL) ?? null;
}

/** The next row, up or down, whose cell at `index` holds a trigger, skipping group rows. */
function verticalTarget(row: HTMLTableRowElement, index: number, step: 1 | -1): HTMLElement | null {
  let next: Element | null = step === 1 ? row.nextElementSibling : row.previousElementSibling;
  while (next !== null) {
    const trigger = triggerAt(next, index);
    if (trigger !== null) {
      return trigger;
    }
    next = step === 1 ? next.nextElementSibling : next.previousElementSibling;
  }
  return null;
}

/** The next trigger along a row, left or right, past cells that hold none. */
function horizontalTarget(row: HTMLTableRowElement, index: number, step: 1 | -1): HTMLElement | null {
  for (let column = index + step; column >= 0 && column < row.cells.length; column += step) {
    const trigger = triggerAt(row, column);
    if (trigger !== null) {
      return trigger;
    }
  }
  return null;
}

/** The keys the grid moves focus with, which it consumes even where focus cannot move. */
const NAVIGATION_KEYS: ReadonlySet<string> = new Set([
  "ArrowRight",
  "ArrowLeft",
  "ArrowDown",
  "ArrowUp",
  "Home",
  "End",
]);

/** Where an arrow, Home or End key moves focus from `cell`, or `null` to stay. */
function targetFor(key: string, cell: HTMLElement, grid: HTMLElement, ctrl: boolean): HTMLElement | null {
  const td = cell.closest("td");
  const row = td?.parentElement;
  if (td === null || !(row instanceof HTMLTableRowElement)) {
    return null;
  }
  const all = [...grid.querySelectorAll<HTMLElement>(CELL)];
  switch (key) {
    case "ArrowRight":
      return horizontalTarget(row, td.cellIndex, 1);
    case "ArrowLeft":
      return horizontalTarget(row, td.cellIndex, -1);
    case "ArrowDown":
      return verticalTarget(row, td.cellIndex, 1);
    case "ArrowUp":
      return verticalTarget(row, td.cellIndex, -1);
    case "Home":
      return ctrl ? (all[0] ?? null) : horizontalTarget(row, -1, 1);
    case "End":
      return ctrl ? (all.at(-1) ?? null) : horizontalTarget(row, row.cells.length, -1);
    default:
      return null;
  }
}

/**
 * Makes `cell` the grid's one tab stop. The triggers render `tabIndex={-1}` and React never writes
 * that prop again while it stays the same, so the stop moves here without re-rendering the cells.
 */
function moveTabStop(grid: HTMLElement, cell: HTMLElement): void {
  for (const stop of grid.querySelectorAll<HTMLElement>(`${CELL}[tabindex="0"]`)) {
    if (stop !== cell) stop.tabIndex = -1;
  }
  cell.tabIndex = 0;
}

/**
 * The ARIA grid pattern's keyboard model over a table of cell triggers, with a roving tabindex:
 * one trigger is the grid's tab stop, the one last focused or else the first. The arrow keys move
 * focus between cells, Home and End along the row, and Ctrl+Home and Ctrl+End to the grid's
 * ends; group rows and cells without a trigger are passed over.
 *
 * It also outlines, while a cell is under the pointer or focused, every cell in the same brand
 * column that holds the same color. The outline is an attribute the handlers set on the cells
 * directly, so hovering never re-renders the grid's hundreds of cells.
 *
 * It writes the sticky header's rendered height to `--grid-header-height` on the grid element and
 * keeps it current as the header's content changes, so the scroll padding that keeps a focused
 * cell clear of the header always matches the header.
 *
 * @param grid - The element that holds the grid's cells.
 * @param rows - The rows the grid renders; a new array means its cells may have changed, so the
 *   first cell takes the tab stop if the cell that held it is gone.
 * @returns The handlers for the grid's container.
 */
export function useCellGrid<Row>(grid: RefObject<HTMLElement | null>, rows: readonly Row[]) {
  const outlined = useRef<readonly HTMLElement[]>([]);

  useLayoutEffect(() => {
    const element = grid.current;
    const head = element?.querySelector("thead");
    if (element === null || head === null || head === undefined) {
      return undefined;
    }
    const measure = (): void => {
      element.style.setProperty(HEADER_HEIGHT, `${String(head.getBoundingClientRect().height)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(head);
    return () => observer.disconnect();
  }, [grid]);

  // A filter or a switch can unmount the cell that held the tab stop; the first cell takes it.
  useLayoutEffect(() => {
    const element = grid.current;
    if (element?.querySelector(`${CELL}[tabindex="0"]`) !== null) {
      return;
    }
    const first = element.querySelector<HTMLElement>(CELL);
    if (first !== null) moveTabStop(element, first);
  }, [grid, rows]);

  const clearOutline = (): void => {
    for (const element of outlined.current) {
      element.removeAttribute(SAME_TONE);
    }
    outlined.current = [];
  };

  const outline = (cell: HTMLElement, container: HTMLElement): void => {
    clearOutline();
    const tone = cell.dataset.tone;
    const column = cell.dataset.column;
    if (tone === undefined || column === undefined) {
      return;
    }
    const same = [...container.querySelectorAll<HTMLElement>(`${CELL}[data-column="${column}"]`)].filter(
      (candidate) => candidate.dataset.tone === tone
    );
    // One cell alone shares its color with nothing, so nothing outlines.
    if (same.length < 2) {
      return;
    }
    for (const element of same) {
      element.setAttribute(SAME_TONE, "");
    }
    outlined.current = same;
  };

  return {
    onFocus: (event: FocusEvent<HTMLElement>) => {
      const cell = cellOf(event.target);
      if (cell !== null) {
        moveTabStop(event.currentTarget, cell);
        outline(cell, event.currentTarget);
      }
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
        clearOutline();
      }
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const cell = cellOf(event.target);
      if (cell === null || !NAVIGATION_KEYS.has(event.key)) {
        return;
      }
      // At the grid's edge focus stays, and the key must not scroll the page away from it instead.
      event.preventDefault();
      const target = targetFor(event.key, cell, event.currentTarget, event.ctrlKey || event.metaKey);
      if (target === null) {
        return;
      }
      moveTabStop(event.currentTarget, target);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    onPointerOver: (event: { readonly target: EventTarget; readonly currentTarget: HTMLElement }) => {
      const cell = cellOf(event.target);
      if (cell !== null) {
        outline(cell, event.currentTarget);
      }
    },
    onPointerLeave: clearOutline,
  };
}
