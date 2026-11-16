"use client";

import { useContext, useEffect, useRef, useState } from "react";
import type { ComponentProps, MouseEvent, PointerEvent, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { formatNumberCell } from "./data-table-format";
import { HeadNameContext } from "./data-table-head-name";
import type { ResizeColumnSource, ResizeHeaderSource } from "./data-table-source";
import { dataTableVariants } from "./data-table-variants";
import { dataTableStrings } from "./intl";

const { resizeHandle } = dataTableVariants();

/**
 * The custom property a drag writes on its column's `<col>`. The `<col>` reads it ahead of the
 * width React renders, so removing it shows React's latest width, whatever changed during the drag.
 */
const PREVIEW_WIDTH = "--_data-table-column-preview";

/** The width in px that one arrow key press adds or removes. */
const KEYBOARD_STEP = 10;

/** TanStack's `maxSize` for a column definition that sets none. */
const DEFAULT_MAX_SIZE = Number.MAX_SAFE_INTEGER;

/**
 * The narrowest width the handle takes a column to. The handle is at least 24px wide and stands
 * 2px inside the header cell's end, so a narrower column would push it past the cell's start, into
 * the neighbor's handle or out of the table. 32px holds that footprint up to a 20px host root,
 * where the handle is 1.5rem, 30px, wide. TanStack's default `minSize` of 20 is below it.
 */
const HANDLE_MIN_SIZE = 32;

/**
 * A column's width bounds in px, as TanStack resolves them. The minimum is raised to the handle's
 * minimum, but never above the column's current width, so the range contains the width.
 */
type Bounds = { readonly min: number; readonly max: number };

/**
 * The bounds of a column that is `size` px wide. A `maxSize` of `Infinity`, which TanStack reads as
 * no maximum, becomes TanStack's default maximum, since ARIA needs a finite `aria-valuemax`.
 */
function boundsOf(column: ResizeColumnSource, size: number): Bounds {
  const min = Math.min(Math.max(column.columnDef.minSize ?? HANDLE_MIN_SIZE, HANDLE_MIN_SIZE), size);
  const max = column.columnDef.maxSize ?? DEFAULT_MAX_SIZE;
  return { min, max: Math.max(Number.isFinite(max) ? max : DEFAULT_MAX_SIZE, min) };
}

/**
 * A whole-pixel width inside the bounds. TanStack clamps a width only when it reads one, so the
 * handle clamps before it writes, and the app never stores a width the table cannot show.
 */
function clampSize(size: number, bounds: Bounds): number {
  return Math.min(Math.max(Math.round(size), bounds.min), bounds.max);
}

/** `1` when a larger clientX widens the column, and `-1` in a right-to-left layout. */
function directionOf(element: Element): 1 | -1 {
  return getComputedStyle(element).direction === "rtl" ? -1 : 1;
}

/**
 * The `<col>` of the column inside the handle's table, which `DataTable.Header` renders for a
 * sized table. Column ids may hold any character, so the lookup compares the attribute in script
 * instead of building a selector from the id.
 */
function colOf(handle: Element, columnId: string): HTMLTableColElement | undefined {
  for (const col of handle.closest("table")?.querySelectorAll(":scope > colgroup > col") ?? []) {
    if (col instanceof HTMLTableColElement && col.dataset.columnId === columnId) {
      return col;
    }
  }
  return undefined;
}

/** One pointer drag, from press to release. */
type DragSession = {
  readonly pointerId: number;
  readonly startX: number;
  readonly startSize: number;
  readonly direction: 1 | -1;
  readonly col: HTMLTableColElement | undefined;
  size: number;
};

/** Removes a drag's preview, so its `<col>` shows the width React renders. */
function clearPreview(session: DragSession): void {
  session.col?.style.removeProperty(PREVIEW_WIDTH);
}

/**
 * The width a key moves the column to, or `undefined` for a key the handle does not handle. End
 * moves only to a maximum the column sets, since TanStack's default is out of reach.
 */
function keyTarget(key: string, size: number, bounds: Bounds, direction: 1 | -1): number | undefined {
  switch (key) {
    case "ArrowRight":
      return clampSize(size + KEYBOARD_STEP * direction, bounds);
    case "ArrowLeft":
      return clampSize(size - KEYBOARD_STEP * direction, bounds);
    case "Home":
      return bounds.min;
    case "End":
      return bounds.max < DEFAULT_MAX_SIZE ? bounds.max : undefined;
    default:
      return undefined;
  }
}

/** Props for `DataTable.ResizeHandle`. */
export type DataTableResizeHandleProps = Omit<
  ComponentProps<"div">,
  | "children"
  | "role"
  | "tabIndex"
  | "aria-label"
  | "aria-orientation"
  | "aria-valuenow"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuetext"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onLostPointerCapture"
  | "onKeyDown"
> & {
  /**
   * The header whose column the handle resizes, from a table with `columnSizingFeature` and
   * `columnResizingFeature`. A header that groups other headers gets no handle. Resize its leaf
   * columns instead.
   */
  header: ResizeHeaderSource;
  /**
   * The column's name as its header shows it, such as `"Status"`. Fuse builds the handle's
   * localized accessible name from it, such as "Resize Status column", so no two handles share a
   * name. Inside `DataTable.Header` or `DataTable.Content` it also names the header cell once the
   * handle has mounted, after hydration. Without it the cell's name would include the handle's
   * width. Give a header cell that Fuse does not render an `aria-label` with the column's name.
   */
  columnName: string;
};

/** Keeps a click on the handle from the header around it, such as a click-to-sort header. */
function stopAtHandle(event: MouseEvent<HTMLDivElement>): void {
  event.stopPropagation();
}

/**
 * The handle of a column that can resize. It owns the drag, so a drag ends with it: a handle that
 * unmounts mid-drag, as when the column stops being resizable, removes its preview.
 */
function ResizeHandleControl({
  column,
  columnName,
  className,
  ...props
}: Omit<DataTableResizeHandleProps, "header"> & { column: ResizeColumnSource }): ReactElement {
  const strings = useLocalizedStrings(dataTableStrings);
  const { locale } = useLocale();
  const nameHead = useContext(HeadNameContext);
  // The width a pointer drag previews, which the handle announces until the drag ends. Only the
  // handle renders on a move.
  const [previewSize, setPreviewSize] = useState<number | undefined>(undefined);
  const drag = useRef<DragSession | undefined>(undefined);

  useEffect(() => {
    if (nameHead === undefined) {
      return undefined;
    }
    nameHead(columnName);
    return () => {
      nameHead(undefined);
    };
  }, [nameHead, columnName]);

  useEffect(
    () => () => {
      const session = drag.current;
      drag.current = undefined;
      if (session !== undefined) {
        clearPreview(session);
      }
    },
    []
  );

  const size = column.getSize();
  const bounds = boundsOf(column, size);
  const announced = previewSize ?? size;

  const commit = (next: number, from: number): void => {
    if (next !== from) {
      column.table.setColumnSizing((old) => ({ ...old, [column.id]: next }));
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>, outcome: "commit" | "cancel"): void => {
    const session = drag.current;
    if (session === undefined || event.pointerId !== session.pointerId) {
      return;
    }
    drag.current = undefined;
    clearPreview(session);
    setPreviewSize(undefined);
    if (outcome === "commit") {
      commit(session.size, session.startSize);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={strings.format("resizeColumn", { name: columnName })}
      aria-valuenow={announced}
      aria-valuemin={bounds.min}
      // Always set: ARIA reads an omitted maximum as 100.
      aria-valuemax={bounds.max}
      aria-valuetext={strings.format("columnWidth", {
        width: formatNumberCell(locale, announced, { maximumFractionDigits: 0 }),
      })}
      tabIndex={0}
      data-slot="data-table-resize-handle"
      {...definedProps({ "data-resizing": previewSize === undefined ? undefined : "" })}
      className={cn(resizeHandle(), className)}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) {
          return;
        }
        // No text selection starts, and the press never reaches the sort button or the row.
        event.preventDefault();
        const handle = event.currentTarget;
        handle.setPointerCapture(event.pointerId);
        // `preventDefault` also cancels the press's focus, which the arrow keys need.
        handle.focus({ preventScroll: true });
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startSize: size,
          direction: directionOf(handle),
          col: colOf(handle, column.id),
          size,
        };
        setPreviewSize(size);
      }}
      onPointerMove={(event) => {
        const session = drag.current;
        if (session === undefined || event.pointerId !== session.pointerId) {
          return;
        }
        session.size = clampSize(
          session.startSize + (event.clientX - session.startX) * session.direction,
          bounds
        );
        session.col?.style.setProperty(PREVIEW_WIDTH, `${String(session.size)}px`);
        setPreviewSize(session.size);
      }}
      onPointerUp={(event) => {
        endDrag(event, "commit");
      }}
      onPointerCancel={(event) => {
        endDrag(event, "cancel");
      }}
      onLostPointerCapture={(event) => {
        endDrag(event, "cancel");
      }}
      onKeyDown={(event) => {
        // A chord with Alt, Control or Meta is a browser or system shortcut, such as Alt+Arrow Left for Back.
        if (event.altKey || event.ctrlKey || event.metaKey) {
          return;
        }
        const next = keyTarget(event.key, size, bounds, directionOf(event.currentTarget));
        if (next === undefined) {
          return;
        }
        event.preventDefault();
        commit(next, size);
      }}
      {...mergeProps<"div">(
        {
          onClick: stopAtHandle,
          onDoubleClick: (event) => {
            stopAtHandle(event);
            column.resetSize();
          },
        },
        props
      )}
    />
  );
}

/**
 * A column header's resize handle, a focusable vertical `separator` at the header cell's
 * inline-end edge. Dragging it previews the width on the page and commits it to `columnSizing` once,
 * on release, so no row renders during the drag. The arrow keys change the width by 10px, and
 * Home and End move it to the column's `minSize` and `maxSize`. The handle does not narrow a column
 * below 32px, which its own 24px target needs. A double-click resets the column to
 * its default width. Its clicks do not reach the header around it. A column that cannot resize
 * renders nothing.
 */
export function DataTableResizeHandle({ header, ...props }: DataTableResizeHandleProps): ReactElement | null {
  if (header.subHeaders.length > 0 || !header.column.getCanResize()) {
    return null;
  }
  return <ResizeHandleControl column={header.column} {...props} />;
}

DataTableResizeHandle.displayName = "DataTable.ResizeHandle";
