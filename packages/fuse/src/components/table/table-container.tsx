"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";

import { definedProps } from "../../internal/defined-props";
import { windowOf } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { frameTableContainerShellClass } from "../../styles/inner-corner/frame";
import { insetFocusOutlineClass } from "../../styles/utils";

/** The `overflow-x` values that let a box scroll. `visible` and `clip` never do. */
const SCROLLING_OVERFLOW = new Set(["auto", "scroll"]);

/** Props for `TableContainer`: its table, and the table's props that decide the box's stop. */
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
 * The box around `Table.Root`'s `<table>` that scrolls it sideways. Package-private.
 *
 * While the table is wider than the box and the box can scroll, the box is a tab stop, so a keyboard
 * user can focus it and scroll it with the browser's scrolling keys. Overflow is the only condition.
 * Base UI's `ScrollArea.Viewport` follows the same rule and takes `tabIndex` 0 while either axis
 * overflows. Base UI writes -1 when nothing overflows, and this box writes no `tabIndex` then. A
 * control inside the table keeps the stop: a hidden or disabled control cannot scroll the box, and a
 * text input keeps the arrow keys for its caret. A consumer style that sets the box to
 * `overflow: visible` lets the table spill out, and the box then adds no stop.
 *
 * A table that sets its own `tabIndex` handles its own focus, as the chart's data table does. The box
 * then writes `tabIndex` -1, since Chromium otherwise makes a scrolling box with no tab stop inside
 * it a stop of its own, and it measures nothing.
 *
 * The stop is a `group` named by the table's `aria-labelledby` and `aria-label`, as given, so the
 * browser applies its own fallback between them. With neither, the group references the table's
 * caption, and the box gives a caption without an id a generated one. A `group` takes no name from
 * its content, so the stop of an unnamed table without a caption has no name.
 *
 * The server renders no stop, and the first measurement after hydration adds it. Every cause of a
 * remeasure waits for one shared animation frame. The causes are a ResizeObserver on the box and the
 * table, a MutationObserver on the text, children, `class` and `style` below the box, and every
 * render, which catches a changed class or style on an ancestor. The MutationObserver is there
 * because a cell's longer text or changed style can widen a fixed-layout table's overflow while no
 * box resizes. An environment without either observer, such as jsdom, gets the table with no stop.
 */
export function TableContainer({
  "aria-label": label,
  "aria-labelledby": labelledBy,
  tableTabIndex,
  children,
}: TableContainerProps): ReactElement {
  const boxRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<() => void>(() => undefined);
  const [scrolls, setScrolls] = useState(false);
  const [captionId, setCaptionId] = useState<string | undefined>(undefined);
  const generatedCaptionId = useId();
  const tableHandlesFocus = tableTabIndex !== undefined;

  useEffect(() => {
    const box = boxRef.current;
    if (box === null || tableHandlesFocus) return;
    // The consumer's `ref` lands on the table, so the box finds its table instead of holding a ref.
    const table = box.querySelector<HTMLTableElement>(":scope > table");
    if (table === null) return;
    const view = windowOf(box);
    if (!("ResizeObserver" in view) || !("MutationObserver" in view)) return;
    let frame: number | null = null;
    const measure = (): void => {
      frame = null;
      setScrolls(
        box.scrollWidth > box.clientWidth && SCROLLING_OVERFLOW.has(view.getComputedStyle(box).overflowX)
      );
      const caption = table.caption;
      if (caption?.id === "") caption.id = generatedCaptionId;
      setCaptionId(caption?.id);
    };
    const schedule = (): void => {
      frame ??= view.requestAnimationFrame(measure);
    };
    const sizes = new view.ResizeObserver(schedule);
    sizes.observe(box);
    sizes.observe(table);
    const content = new view.MutationObserver(schedule);
    content.observe(box, {
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
      if (frame !== null) view.cancelAnimationFrame(frame);
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
      ref={boxRef}
      data-slot="table-container"
      {...stopProps}
      className={cn(
        frameTableContainerShellClass,
        "relative w-full overflow-x-auto",
        insetFocusOutlineClass
      )}>
      {children}
    </div>
  );
}
