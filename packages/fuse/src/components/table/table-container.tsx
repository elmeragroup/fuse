"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";

import { definedProps } from "../../internal/defined-props";
import { windowOf } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { frameTableContainerShellClass } from "../../styles/inner-corner/frame";
import { overlayFocusRingClass, overlayFocusRingControlClass } from "../../styles/utils";

/** The `overflow-x` values that let a box scroll. `visible` and `clip` never do. */
const SCROLLING_OVERFLOW = new Set(["auto", "scroll"]);

/** Props for `TableContainer`: its table, and the table's props that decide the viewport's stop. */
type TableContainerProps = {
  /** The table's `aria-label`. */
  readonly "aria-label"?: string | undefined;
  /** The table's `aria-labelledby`. */
  readonly "aria-labelledby"?: string | undefined;
  /** The table's own `tabIndex`. */
  readonly tableTabIndex?: number | undefined;
  /** The `<table>`. */
  readonly children: ReactElement;
};

/**
 * The boxes around `Table.Root`'s `<table>` that scroll it sideways. Package-private.
 *
 * The outer box, `table-container`, is the one a Frame, a panel or a `VerticalTable.Body` styles as
 * the Table's item. It holds the scrolling box, `table-viewport`, and after it an empty
 * `table-focus-indicator` that draws the viewport's focus outline above the table's positioned
 * parts. The container never scrolls. It is a flex column with a zero minimum size, so a flex or
 * grid parent that caps its height or width shrinks it, and the viewport fills it and scrolls both
 * axes. A sticky `Table.Header` then stays at the viewport's top. As a flex column, the container
 * gives an inline-block parent the first baseline of the table's content. A consumer style that sets
 * the viewport to `overflow: visible` lets the table spill out, and the viewport then adds no stop.
 *
 * While the table is wider than the viewport and the viewport can scroll, the viewport is a tab
 * stop, so a keyboard user can focus it and scroll it with the browser's scrolling keys. Overflow is
 * the only condition. Base UI's `ScrollArea.Viewport` follows the same rule and takes `tabIndex` 0
 * while either axis overflows. Base UI writes -1 when nothing overflows, and this viewport writes no
 * `tabIndex` then. A control inside the table keeps the stop: a hidden or disabled control cannot
 * scroll the viewport, and a text input keeps the arrow keys for its caret.
 *
 * A table that sets its own `tabIndex` handles its own focus, as the chart's data table does. The
 * viewport then writes `tabIndex` -1, since Chromium otherwise makes a scrolling box with no tab stop
 * inside it a stop of its own, and it measures nothing.
 *
 * The stop is a `group` named by the table's `aria-labelledby` and `aria-label`, as given, so the
 * browser applies its own fallback between them. With neither, the group references the table's
 * caption, and the viewport gives a caption without an id a generated one. A `group` takes no name
 * from its content, so the stop of an unnamed table without a caption has no name.
 *
 * The server renders no stop, and the first measurement after hydration adds it. Every cause of a
 * remeasure waits for one shared animation frame. The causes are a ResizeObserver on the viewport
 * and the table, a MutationObserver on the text, children, `class` and `style` below the viewport,
 * and every render, which catches a changed class or style on an ancestor. The MutationObserver is
 * there because a cell's longer text or changed style can widen a fixed-layout table's overflow
 * while no box resizes. An environment without either observer, such as jsdom, gets the table with
 * no stop.
 */
export function TableContainer({
  "aria-label": label,
  "aria-labelledby": labelledBy,
  tableTabIndex,
  children,
}: TableContainerProps): ReactElement {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<() => void>(() => undefined);
  const [scrolls, setScrolls] = useState(false);
  const [captionId, setCaptionId] = useState<string | undefined>(undefined);
  const generatedCaptionId = useId();
  const tableHandlesFocus = tableTabIndex !== undefined;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || tableHandlesFocus) return;
    // The consumer's `ref` lands on the table, so the viewport finds its table instead of holding a ref.
    const table = viewport.querySelector<HTMLTableElement>(":scope > table");
    if (table === null) return;
    const view = windowOf(viewport);
    if (!("ResizeObserver" in view) || !("MutationObserver" in view)) return;
    // Frames and styles go through the host's window: the viewport's own window shows another
    // document once a frame it renders into navigates, where a cancel would hit that document's frame.
    let frame: number | null = null;
    const measure = (): void => {
      frame = null;
      setScrolls(
        viewport.scrollWidth > viewport.clientWidth &&
          SCROLLING_OVERFLOW.has(getComputedStyle(viewport).overflowX)
      );
      const caption = table.caption;
      if (caption?.id === "") caption.id = generatedCaptionId;
      setCaptionId(caption?.id);
    };
    const schedule = (): void => {
      frame ??= requestAnimationFrame(measure);
    };
    const sizes = new view.ResizeObserver(schedule);
    sizes.observe(viewport);
    sizes.observe(table);
    const content = new view.MutationObserver(schedule);
    content.observe(viewport, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    scheduleRef.current = schedule;
    return () => {
      scheduleRef.current = () => undefined;
      sizes.disconnect();
      content.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [tableHandlesFocus, generatedCaptionId]);

  useEffect(() => {
    scheduleRef.current();
  });

  const groupLabelledBy = labelledBy ?? (label === undefined ? captionId : undefined);
  const stopProps = tableHandlesFocus
    ? { tabIndex: -1 }
    : scrolls
      ? {
          tabIndex: 0,
          role: "group",
          ...definedProps({ "aria-labelledby": groupLabelledBy, "aria-label": label }),
        }
      : undefined;
  return (
    <div
      data-slot="table-container"
      className={cn(frameTableContainerShellClass, "relative flex min-h-0 w-full min-w-0 flex-col")}>
      <div
        ref={viewportRef}
        data-slot="table-viewport"
        {...stopProps}
        className={cn(
          "relative min-h-0 w-full flex-1 overflow-x-auto rounded-[inherit]",
          overlayFocusRingControlClass
        )}>
        {children}
      </div>
      {/* While the viewport has focus it isolates, so a framed body, a sticky cell or a table's own
          z-index stacks inside it, and this later sibling paints the outline above them. */}
      <span aria-hidden data-slot="table-focus-indicator" className={overlayFocusRingClass} />
    </div>
  );
}
