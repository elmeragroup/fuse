"use client";

import type { ComponentProps, FocusEvent, ReactElement, RefObject } from "react";
import { createContext, use, useId, useLayoutEffect, useRef, useState } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { useStableCallback } from "../../hooks/use-stable-callback";
import { activeElementFrom } from "../../internal/active-element";
import { definedProps } from "../../internal/defined-props";
import { containsAcrossShadowRoots, isHTMLElement } from "../../internal/dom-node";
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
  /** Records where focus entered the detail, its portalled popups included. */
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
  readonly onFocusCapture: (event: FocusEvent) => void;
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
   * Whether the detail Sheet is open. The app holds the selected item, and `open` says only
   * whether its Sheet is open. Set it when the user opens an item, and follow `onOpenChange`.
   * From the breakpoint the pane shows the item instead, so the root answers an `open` there with
   * `onOpenChange(false)`, and the Sheet stays closed until the root narrows with focus in the
   * pane.
   */
  open: boolean;
  /**
   * Called when the Sheet asks to open or close, when the pane takes over an open Sheet's item,
   * and when the root stops splitting with focus inside the pane, which opens the Sheet.
   *
   * A change of layout, from the root's width, the root font size or `split`, keeps focus where
   * the user was. Losing the split with focus inside the pane opens the Sheet, which takes focus.
   * With focus elsewhere the list keeps it. Gaining the split with focus inside the Sheet moves
   * focus to the pane, after any menu or dialog open in the Sheet has closed. A Sheet that opened
   * because the root narrowed returns focus, when it closes, to the list item that last held
   * focus.
   */
  onOpenChange: (open: boolean) => void;
  /**
   * The root width from which the detail is a complementary pane beside the list. Below it, the
   * detail opens in a Sheet over the list. The breakpoint is a container query on the root, so it
   * follows the room the root has: a Sidebar opening beside it narrows it as a smaller window
   * does. The root takes its width from its parent. The server renders the split layout, and CSS
   * hides the pane in a root narrower than the breakpoint, so the first paint matches before any
   * script runs. Pass `never` to keep the detail in a Sheet at every width, for a list that needs
   * all of its width, such as a wide table.
   */
  split?: ListDetailSplit;
};

/**
 * A list with the detail of its open item: a pane beside the list from the `split` width of the
 * root, and a Sheet over the list below it. The client follows the same container query as the
 * server-rendered CSS, at the root's layout width and the current root font size, and swaps the
 * pane for the Sheet below the breakpoint.
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
  // The layout the client last read from the container query, unset until its first reading.
  // Until then the pane's CSS hides it in a root too narrow for it; from then on the client alone
  // removes it, after reading where focus is, as a pane the CSS hid first would make the browser
  // drop the focus inside it.
  const [read, setRead] = useState<ListDetailLayout | undefined>(undefined);
  // Split on the server and through hydration, as the pane's own CSS is; `never` has no pane.
  const layout = read ?? (split === "never" ? "overlay" : "split");
  // Whether the Sheet is one the root opened when it narrowed with focus in the pane. It changes
  // only as the Sheet opens, so a closing Sheet keeps its return target through its exit.
  const [opened, setOpened] = useState(false);
  const requested = useRef(false);
  const wasOpen = useRef(open);
  // A widening that moves focus from the Sheet to the pane.
  const focusPane = useRef(false);
  const list = useRef<HTMLElement | null>(null);
  const listFocus = useRef<HTMLElement | null>(null);
  // The element focus last entered the detail on. React focus events bubble along the React tree,
  // so focus in the detail's portalled popups, such as its menus, lands here, and so does focus in
  // a shadow root below it, whose events reach React retargeted to their host.
  const detailFocus = useRef<Element | null>(null);
  const [focusTracking] = useState<FocusTracking>(() => ({
    onFocusCapture: (event) => {
      detailFocus.current = event.target;
    },
  }));
  // Whether focus is in the detail now. Read from where focus is rather than kept from blur
  // events, since a focused element the detail removes fires no blur.
  const focusInDetail = (): boolean => {
    const entered = detailFocus.current;
    if (entered === null || !entered.isConnected) {
      return false;
    }
    const active = activeElementFrom(entered);
    return active !== null && containsAcrossShadowRoots(entered, active);
  };
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
  // focuses. Focus the user moved out of the Sheet elsewhere stays where it went: a function
  // `finalFocus` skips Base UI's own check for that, as `focusMovedElsewhere` in
  // `data-table-filter/filter-focus.ts` works around too; #612 tracks a shared helper.
  const returnToList = useStableCallback((): HTMLElement | boolean => {
    const active = list.current === null ? null : activeElementFrom(list.current);
    if (active !== null && active !== active.ownerDocument.body && !focusInDetail()) {
      return false;
    }
    return listFocus.current?.isConnected === true ? listFocus.current : (list.current ?? true);
  });
  // The layout the container query last gave, unset until the client first reads it.
  const queried = useRef<ListDetailLayout | undefined>(undefined);
  const styled = listDetailVariants({ split, settled: read !== undefined });

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
    const crossed = previous !== undefined && previous !== next && focusInDetail();
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
    setRead(next);
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

export type ListDetailDetailProps = Omit<useRender.ComponentProps<"aside">, "children" | "aria-label"> & {
  /**
   * The open item's detail, with a `ListDetail.Title` that names the pane and the Sheet's dialog.
   * The pane shows at every width from the breakpoint, so render an empty state here while
   * nothing is selected. The content remounts on a change of layout, so keep a draft it must not
   * lose in state above it.
   */
  children?: useRender.ComponentProps<"aside">["children"];
  /**
   * The pane's or the dialog's name while no `ListDetail.Title` is mounted, such as while nothing
   * is selected. The element props, `className`, `ref` and `render` land on whichever is mounted.
   */
  "aria-label"?: useRender.ComponentProps<"aside">["aria-label"];
  /** The Sheet's maximum width, as on `Sheet.Content`. It applies below the breakpoint only. */
  size?: SheetContentProps["size"];
  /** Shows the Sheet's corner close button. It applies below the breakpoint only. */
  showCloseButton?: boolean;
  /**
   * The Sheet's corner close button's accessible name. Unset, it reads `overlay.close` from the
   * locale dictionary. It applies below the breakpoint only.
   */
  closeLabel?: string;
};

/**
 * The open item's detail: a complementary `<aside>` beside the list in the split layout, and the
 * Sheet's dialog below the breakpoint.
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
  const elementProps = mergeProps<"aside">(focusTracking, definedProps(props));
  const content = <DetailContext value={{ layout, nameBy: setTitleId }}>{children}</DetailContext>;

  const aside = useRender({
    defaultTagName: "aside",
    enabled: layout === "split",
    ref: attach,
    props: {
      "data-slot": "list-detail-detail",
      "data-layout": layout,
      tabIndex: -1,
      ...definedProps({ "aria-labelledby": titleId }),
      className: cn(pane, className),
      ...elementProps,
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
        data-layout="overlay"
        className={className}
        {...definedProps({
          finalFocus: returnToList,
          size,
          showCloseButton,
          closeLabel,
          render,
          ...elementProps,
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

type SheetCloseProps = ComponentProps<typeof SheetClose>;

/** The props of `ListDetail.Close`, which are `Sheet.Close`'s. */
export type ListDetailCloseProps = Omit<SheetCloseProps, "render"> & {
  /**
   * The button that closes the Sheet, such as `<button type="button" aria-label="Close details" />`,
   * as `Sheet.Close` composes. The close renders only below the breakpoint, where the detail is a
   * Sheet, so a detail can keep it in its own header in both layouts.
   */
  render?: SheetCloseProps["render"];
};

/** Closes the detail Sheet. */
export function ListDetailClose(props: ListDetailCloseProps): ReactElement | null {
  const { layout } = useDetailContext("Close");
  return layout === "overlay" ? <SheetClose {...props} /> : null;
}

ListDetailRoot.displayName = "ListDetail.Root";
ListDetailList.displayName = "ListDetail.List";
ListDetailDetail.displayName = "ListDetail.Detail";
ListDetailTitle.displayName = "ListDetail.Title";
ListDetailClose.displayName = "ListDetail.Close";
