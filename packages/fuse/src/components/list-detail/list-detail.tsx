"use client";

import type { ComponentProps, FocusEvent, ReactElement, RefObject } from "react";
import { createContext, use, useId, useLayoutEffect, useRef, useState } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { useStableCallback } from "../../hooks/use-stable-callback";
import { deepActiveElement } from "../../internal/active-element";
import { definedProps } from "../../internal/defined-props";
import { isHTMLElement } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayTitleClass } from "../overlay/overlay-classes";
import { SheetClose, SheetContent, SheetRoot, SheetTitle } from "../sheet/sheet";
import type { SheetContentProps } from "../sheet/sheet";
import { listDetailVariants } from "./list-detail-variants";

const styles = listDetailVariants();

/**
 * Where the detail shows: `split` in a pane beside the list, `overlay` in a Sheet over it.
 */
type ListDetailLayout = "split" | "overlay";

/**
 * The root width from which the detail sits beside the list: Tailwind's `@3xl` (48rem), `@4xl`
 * (56rem) or `@5xl` (64rem) container size, or `never` for a list that keeps every width, such
 * as a wide table, and opens its detail in a Sheet at any size.
 */
export type ListDetailSplit = "3xl" | "4xl" | "5xl" | "never";

type RootContextValue = {
  readonly layout: ListDetailLayout;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The mounted detail container, the pane or the Sheet's popup. */
  readonly detail: RefObject<HTMLElement | null>;
  /** The pane's classes, which show it from the root's `split` width. */
  readonly pane: string;
  /** Tracks whether focus is in the detail, its portalled popups included. */
  readonly focusTracking: FocusTracking;
  /** Records the list's last focused element, and the list itself, as a Sheet's return target. */
  readonly listTracking: ListTracking;
  /**
   * Where a Sheet the root opened on narrowing returns focus, since the pane that held it is gone;
   * unset for a Sheet the user opened, which returns focus as a Sheet does.
   */
  readonly returnToList: (() => HTMLElement | boolean) | undefined;
};

type FocusTracking = {
  readonly onFocusCapture: () => void;
  readonly onBlurCapture: () => void;
};

type ListTracking = {
  readonly ref: (node: HTMLElement | null) => void;
  readonly onFocusCapture: (event: FocusEvent) => void;
};

const RootContext = createContext<RootContextValue | undefined>(undefined);

type DetailContextValue = {
  readonly layout: ListDetailLayout;
  /** Names the pane after a mounted `ListDetail.Title`; the Sheet's title wires itself. */
  readonly nameBy: (id: string | undefined) => void;
};

const DetailContext = createContext<DetailContextValue | undefined>(undefined);

function useRootContext(part: string): RootContextValue {
  const value = use(RootContext);
  if (value === undefined) {
    throw new Error(`ListDetail.${part} must be rendered inside ListDetail.Root.`);
  }
  return value;
}

function useDetailContext(part: string): DetailContextValue {
  const value = use(DetailContext);
  if (value === undefined) {
    throw new Error(`ListDetail.${part} must be rendered inside ListDetail.Detail.`);
  }
  return value;
}

export type ListDetailRootProps = useRender.ComponentProps<"div"> & {
  /**
   * Whether the detail Sheet is open. Set it when the user opens an item. From the breakpoint
   * the pane shows the item instead, so the root answers an `open` there with
   * `onOpenChange(false)`, and the Sheet stays closed until the root narrows with focus in the
   * pane.
   */
  open: boolean;
  /**
   * Called when the Sheet asks to open or close, when the pane takes over an open Sheet's item,
   * and when the root stops splitting with focus inside the pane, which opens the Sheet.
   */
  onOpenChange: (open: boolean) => void;
  /**
   * The root width from which the detail sits beside the list.
   * @default "4xl"
   */
  split?: ListDetailSplit;
};

/**
 * A list with the detail of its open item: a pane beside the list from the `split` width of the
 * root, a Sheet over the list below it. The breakpoint is a container query on the root, so it
 * follows the room the root has, and the root takes its width from its parent.
 *
 * The server renders the split layout, and CSS hides the pane while the root is narrower than
 * the breakpoint, so the first paint matches the root's width. The client then follows the same
 * container query and swaps the pane for the Sheet below the breakpoint.
 *
 * A change of layout, from the root's width, the root font size or `split`, keeps the user where
 * they were. Losing the split with focus inside the pane opens the Sheet, which takes focus; with
 * focus elsewhere the list keeps it. Gaining the split with focus inside the Sheet moves focus to
 * the pane. The detail's content remounts on a change of layout, so keep a draft it must not lose
 * in state above it.
 */
export function ListDetailRoot({
  open,
  onOpenChange,
  split = "4xl",
  className,
  render,
  ref,
  children,
  ...props
}: ListDetailRootProps): ReactElement {
  const probe = useRef<HTMLSpanElement>(null);
  const detail = useRef<HTMLElement | null>(null);
  // Split on the server and through hydration, as the pane's own CSS is; `never` has no pane.
  const [layout, setLayout] = useState<ListDetailLayout>(split === "never" ? "overlay" : "split");
  // Whether the Sheet is one the root opened when it narrowed with focus in the pane. It changes
  // only as the Sheet opens, so a closing Sheet keeps its return target through its exit.
  const [opened, setOpened] = useState(false);
  const requested = useRef(false);
  const wasOpen = useRef(open);
  // A widening that moves focus from the Sheet to the pane.
  const focusPane = useRef(false);
  const list = useRef<HTMLElement | null>(null);
  const listFocus = useRef<HTMLElement | null>(null);
  // Whether the client has read the container query. Until then the pane's CSS hides it in a root
  // too narrow for it; from then on the client alone removes it, after reading where focus is, as
  // a pane the CSS hid first would make the browser drop the focus inside it.
  const [settled, setSettled] = useState(false);
  // Whether focus is in the detail. React focus events bubble along the React tree, so focus in
  // the detail's portalled popups, such as its menus, counts, and so does focus in a shadow root
  // below it, whose events reach React retargeted to their host.
  const focusInDetail = useRef(false);
  const [focusTracking] = useState<FocusTracking>(() => ({
    onFocusCapture: () => {
      focusInDetail.current = true;
    },
    onBlurCapture: () => {
      focusInDetail.current = false;
    },
  }));
  const [listTracking] = useState<ListTracking>(() => ({
    ref: (node) => {
      list.current = node;
    },
    onFocusCapture: (event) => {
      if (isHTMLElement(event.target)) {
        listFocus.current = event.target;
      }
    },
  }));
  // The list item that last held focus, or else the list, whose first tabbable item the Sheet then
  // focuses. Focus the user moved out of the Sheet elsewhere stays where it went.
  const returnToList = useStableCallback((): HTMLElement | boolean => {
    const active = list.current === null ? null : deepActiveElement(list.current.ownerDocument);
    if (active !== null && active !== active.ownerDocument.body && !focusInDetail.current) {
      return false;
    }
    return listFocus.current?.isConnected === true ? listFocus.current : (list.current ?? true);
  });
  // The layout the container query last gave, unset until the client first reads it.
  const queried = useRef<ListDetailLayout | undefined>(undefined);
  const styled = listDetailVariants({ split, settled });

  // Follows the container query through the probe, which has a box only while it matches. The
  // first reading settles what the server could not know; a later change carries the user across.
  const reconcile = useStableCallback(() => {
    const element = probe.current;
    if (element === null) {
      return;
    }
    const next: ListDetailLayout = getComputedStyle(element).display === "none" ? "overlay" : "split";
    const previous = queried.current;
    queried.current = next;
    // A focused element removed with the detail fires no blur, so the document must still hold focus.
    const active = deepActiveElement(element.ownerDocument);
    const focused = focusInDetail.current && active !== null && active !== element.ownerDocument.body;
    const crossed = previous !== undefined && previous !== next && focused;
    if (crossed && next === "split") {
      focusPane.current = true;
    }
    if (crossed && next === "overlay") {
      if (open) {
        setOpened(true);
      } else {
        requested.current = true;
        onOpenChange(true);
      }
    }
    if (open && !wasOpen.current) {
      setOpened(requested.current);
      requested.current = false;
    }
    wasOpen.current = open;
    if (next === "split" && open) {
      onOpenChange(false);
    }
    setLayout(next);
    setSettled(true);
  });

  useLayoutEffect(() => {
    reconcile();
  }, [split, open, reconcile]);

  useLayoutEffect(() => {
    const element = probe.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver(reconcile);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [reconcile]);

  useLayoutEffect(() => {
    if (layout !== "split" || !focusPane.current) {
      return;
    }
    focusPane.current = false;
    const pane = detail.current;
    // The Sheet and every overlay nested in it queued their focus restoration as they unmounted
    // in this commit; a microtask queued now runs after all of them, so the pane keeps focus.
    queueMicrotask(() => {
      pane?.focus();
    });
  }, [layout]);

  const element = useRender({
    defaultTagName: "div",
    ref,
    props: {
      "data-slot": "list-detail",
      "data-layout": layout,
      ...mergeProps<"div">({ className: cn(styles.root(), className) }, props),
      children: (
        <>
          {children}
          <span ref={probe} aria-hidden className={styled.probe()} />
        </>
      ),
    },
    render,
  });

  // The ring shows where a change of layout moved focus; the pane takes focus only from script.
  const pane = cn(styled.pane(), selfFocusRingClass);
  return (
    <RootContext
      value={{
        layout,
        open,
        onOpenChange,
        detail,
        pane,
        focusTracking,
        listTracking,
        returnToList: opened ? returnToList : undefined,
      }}>
      {element}
    </RootContext>
  );
}

export type ListDetailListProps = useRender.ComponentProps<"div">;

/**
 * The list column. It takes the width the detail pane leaves and shrinks below its content. It
 * remembers the item that last held focus, where a Sheet the root opened on narrowing returns
 * focus when it closes.
 */
export function ListDetailList({ className, render, ref, ...props }: ListDetailListProps): ReactElement {
  const { listTracking } = useRootContext("List");
  return useRender({
    defaultTagName: "div",
    ref: ref === undefined ? listTracking.ref : [ref, listTracking.ref],
    props: {
      "data-slot": "list-detail-list",
      ...mergeProps<"div">(
        { className: cn(styles.list(), className), onFocusCapture: listTracking.onFocusCapture },
        props
      ),
    },
    render,
  });
}

export type ListDetailDetailProps = useRender.ComponentProps<"aside"> &
  Pick<SheetContentProps, "size" | "showCloseButton" | "closeLabel">;

/**
 * The open item's detail: a complementary `<aside>` beside the list in the split layout, and the
 * Sheet's dialog below the breakpoint. A `ListDetail.Title` inside names both. Its element props,
 * `className`, `ref` and `render` land on whichever is mounted, so an `aria-label` names the pane,
 * or the dialog, whenever no Title is mounted, such as while nothing is selected. `size`,
 * `showCloseButton` and `closeLabel` are the Sheet's and apply below the breakpoint only.
 */
export function ListDetailDetail({
  className,
  children,
  size,
  showCloseButton,
  closeLabel,
  render,
  ref,
  ...props
}: ListDetailDetailProps): ReactElement {
  const { layout, open, onOpenChange, detail, pane, focusTracking, returnToList } = useRootContext("Detail");
  const [titleId, setTitleId] = useState<string | undefined>(undefined);
  const attach = useMergedRefs<HTMLElement>(ref, detail);
  const content = <DetailContext value={{ layout, nameBy: setTitleId }}>{children}</DetailContext>;

  const aside = useRender({
    defaultTagName: "aside",
    enabled: layout === "split",
    ref: attach ?? undefined,
    props: {
      "data-slot": "list-detail-detail",
      "data-layout": layout,
      tabIndex: -1,
      ...definedProps({ "aria-labelledby": titleId }),
      className: cn(pane, className),
      ...mergeProps<"aside">(focusTracking, definedProps(props)),
      children: content,
    },
    render,
  });
  if (aside !== null) {
    return aside;
  }

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-slot="list-detail-detail"
        data-layout={layout}
        className={className}
        {...definedProps({
          finalFocus: returnToList,
          size,
          showCloseButton,
          closeLabel,
          render,
          ...mergeProps<"aside">(focusTracking, definedProps(props)),
        })}
        ref={attach}>
        {content}
      </SheetContent>
    </SheetRoot>
  );
}

export type ListDetailTitleProps = useRender.ComponentProps<"h2">;

/**
 * The detail's heading, an `<h2>` by default. It names the pane beside the list, and the Sheet's
 * dialog below the breakpoint.
 */
export function ListDetailTitle({ className, render, id, ...props }: ListDetailTitleProps): ReactElement {
  const { layout, nameBy } = useDetailContext("Title");
  const generated = useId();
  const titleId = id ?? generated;

  useLayoutEffect(() => {
    if (layout !== "split") {
      return;
    }
    nameBy(titleId);
    return () => {
      nameBy(undefined);
    };
  }, [layout, nameBy, titleId]);

  const split = useRender({
    defaultTagName: "h2",
    enabled: layout === "split",
    props: {
      "data-slot": "list-detail-title",
      ...mergeProps<"h2">({ id: titleId, className: cn(overlayTitleClass, className) }, props),
    },
    render,
  });
  if (split !== null) {
    return split;
  }
  return (
    <SheetTitle
      data-slot="list-detail-title"
      className={className}
      {...definedProps({ id, render, ...props })}
    />
  );
}

export type ListDetailCloseProps = ComponentProps<typeof SheetClose>;

/**
 * Closes the detail Sheet. It renders only below the breakpoint, where the detail is a Sheet, so
 * a detail can place it in its own header in both layouts. Compose it with a button through
 * `render`, as `Sheet.Close` composes.
 */
export function ListDetailClose(props: ListDetailCloseProps): ReactElement | null {
  const { layout } = useDetailContext("Close");
  return layout === "overlay" ? <SheetClose {...props} /> : null;
}

ListDetailRoot.displayName = "ListDetail.Root";
ListDetailList.displayName = "ListDetail.List";
ListDetailDetail.displayName = "ListDetail.Detail";
ListDetailTitle.displayName = "ListDetail.Title";
ListDetailClose.displayName = "ListDetail.Close";
