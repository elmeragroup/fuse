"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import type { ComponentProps, ReactElement } from "react";

import { useOpenChangeComplete } from "@base-ui/react/internals/useOpenChangeComplete";
import { useTransitionStatus } from "@base-ui/react/internals/useTransitionStatus";
import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { X } from "../../icons/generated/x";
import { deepActiveElement } from "../../internal/active-element";
import { containsAcrossShadowRoots, isFocusRoot, isHTMLElement, isNode } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Button } from "../button/button";
import { actionBarVariants } from "./action-bar-variants";
import { actionBarStrings } from "./intl";

const slots = actionBarVariants();

/** The count the parts inside the bar read. While the bar leaves, it keeps the last count above zero. */
const ActionBarCountContext = createContext(0);

/** The props of `ActionBar.Root`: Base UI's toolbar root, horizontal only, plus the selection size. */
export type ActionBarRootProps = Omit<
  ComponentProps<typeof ToolbarPrimitive.Root>,
  "orientation" | "aria-label" | "children"
> & {
  /**
   * How many items the selection holds. While it is above zero, the bar rises into place and a
   * visually hidden live region beside it announces the count politely, such as "3 selected", each
   * time it changes. When it returns to zero, the bar falls away and unmounts. If focus was in the
   * bar, as after Clear, focus returns to the element it came from, such as a row checkbox. If that
   * element is gone, as after deleting the selected rows, focus falls to the page.
   */
  count: number;
  /**
   * The bar's distance from the bottom of its nearest positioned ancestor, in px. Give that
   * ancestor `position: relative` and keep the bar its last child, so the bar paints over the rows.
   * To keep the bar clear of a pagination row or another footer, wrap only the content above the
   * footer in that ancestor. Use `offset` for a small adjustment, such as clearing a faded edge.
   */
  offset?: number;
  /**
   * The bar's name. Without it or `aria-labelledby`, the bar is named "Bulk actions" in the
   * reader's locale.
   */
  "aria-label"?: ComponentProps<typeof ToolbarPrimitive.Root>["aria-label"];
  /**
   * The bar's items: `ActionBar.Count`, `ActionBar.Clear`, `ActionBar.Separator` and
   * `ActionBar.Button`. The bar is one Tab stop, and the arrow keys move between its items.
   */
  children?: ComponentProps<typeof ToolbarPrimitive.Root>["children"];
};

/** The props of `ActionBar.Count`. */
export type ActionBarCountProps = Omit<ComponentProps<"span">, "children"> & {
  /** Text that replaces the count, "3 selected" in the reader's locale. */
  children?: ComponentProps<"span">["children"];
};

/** The props of `ActionBar.Clear`: a toolbar button. */
export type ActionBarClearProps = Omit<
  ComponentProps<typeof ToolbarPrimitive.Button>,
  "onClick" | "aria-label" | "children"
> & {
  /**
   * Empty the selection here. Clear clears nothing itself, and the bar leaves once `count` is zero.
   */
  onClick?: ComponentProps<typeof ToolbarPrimitive.Button>["onClick"];
  /**
   * The button's name. Without it, the button is named "Clear selection" in the reader's locale.
   * To show the name in a tooltip, pass Clear to `Tooltip.Trigger`'s `render`:
   * `<Tooltip.Trigger render={<ActionBar.Clear onClick={clear} />} />`.
   */
  "aria-label"?: ComponentProps<typeof ToolbarPrimitive.Button>["aria-label"];
  /** Content that replaces the X icon. */
  children?: ComponentProps<typeof ToolbarPrimitive.Button>["children"];
};

/** The props of `ActionBar.Button`: a toolbar button. */
export type ActionBarButtonProps = Omit<ComponentProps<typeof ToolbarPrimitive.Button>, "children"> & {
  /**
   * An icon marked `data-icon="inline-start"`, then the words in `ActionBar.ButtonLabel`. While the
   * bar's container is narrower than 28rem, the button shows the icon alone and keeps the words as
   * its accessible name.
   */
  children?: ComponentProps<typeof ToolbarPrimitive.Button>["children"];
};

/** The props of `ActionBar.ButtonLabel`. */
export type ActionBarButtonLabelProps = ComponentProps<"span">;

/** The props of `ActionBar.Separator`: Base UI's toolbar separator. */
export type ActionBarSeparatorProps = ComponentProps<typeof ToolbarPrimitive.Separator>;

function isInside(container: HTMLElement | null, node: EventTarget | null): boolean {
  return container !== null && isNode(node) && containsAcrossShadowRoots(container, node);
}

/**
 * A toolbar of actions on a selection, such as the checked rows of a `DataTable`, that floats at
 * the bottom of its nearest positioned ancestor while `count` is above zero. The leaving bar is
 * `inert` until it unmounts.
 */
export function ActionBarRoot({
  count,
  offset = 16,
  className,
  ref,
  onFocus,
  "aria-label": ariaLabel,
  ...props
}: ActionBarRootProps): ReactElement {
  const strings = useLocalizedStrings(actionBarStrings);
  const open = count > 0;
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs(toolbarRef, ref);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [shownCount, setShownCount] = useState(count);
  if (open && count !== shownCount) {
    setShownCount(count);
  }
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);

  useOpenChangeComplete({
    open,
    ref: toolbarRef,
    onComplete() {
      if (!open) {
        setMounted(false);
      }
    },
  });

  useLayoutEffect(() => {
    if (open) {
      return;
    }
    const toolbar = toolbarRef.current;
    const root = toolbar?.getRootNode();
    if (root === undefined || !isFocusRoot(root)) {
      return;
    }
    const active = deepActiveElement(root);
    if (!isInside(toolbar, active)) {
      return;
    }
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected === true) {
      target.focus();
    } else if (isHTMLElement(active)) {
      active.blur();
    }
  }, [open]);

  // Focus entering from outside records where it came from, for the return when the bar leaves.
  const handleFocus: ActionBarRootProps["onFocus"] = (event) => {
    if (isHTMLElement(event.relatedTarget) && !isInside(toolbarRef.current, event.relatedTarget)) {
      returnFocusRef.current = event.relatedTarget;
    }
    onFocus?.(event);
  };

  const label = props["aria-labelledby"] === undefined ? (ariaLabel ?? strings.format("label")) : ariaLabel;

  return (
    <>
      <span data-slot="action-bar-status" role="status" className="sr-only">
        {open ? strings.format("selected", { count }) : ""}
      </span>
      {mounted ? (
        <div
          data-slot="action-bar-positioner"
          className={slots.positioner()}
          style={{ "--action-bar-offset": `${String(offset)}px` }}
          inert={!open}>
          <ActionBarCountContext.Provider value={shownCount}>
            <ToolbarPrimitive.Root
              data-slot="action-bar"
              data-starting-style={transitionStatus === "starting" ? "" : undefined}
              data-ending-style={transitionStatus === "ending" ? "" : undefined}
              aria-label={label}
              className={mergeClassName(className, slots.root())}
              onFocus={handleFocus}
              {...props}
              ref={mergedRef}
            />
          </ActionBarCountContext.Provider>
        </div>
      ) : null}
    </>
  );
}

/** The selection count. It is not a live region, because `ActionBar.Root` announces the count. */
export function ActionBarCount({ className, children, ...props }: ActionBarCountProps): ReactElement {
  const strings = useLocalizedStrings(actionBarStrings);
  const count = useContext(ActionBarCountContext);
  return (
    <span data-slot="action-bar-count" className={cn(slots.count(), className)} {...props}>
      {children ?? strings.format("selected", { count })}
    </span>
  );
}

/** The button that clears the selection: an extra-small ghost icon button with an X. */
export function ActionBarClear({
  "aria-label": ariaLabel,
  children,
  ...props
}: ActionBarClearProps): ReactElement {
  const strings = useLocalizedStrings(actionBarStrings);
  const label = ariaLabel ?? strings.format("clear");
  return (
    <ToolbarPrimitive.Button
      data-slot="action-bar-clear"
      aria-label={label}
      render={<Button variant="ghost" size="icon-xs" aria-label={label} />}
      {...props}>
      {children ?? <X aria-hidden="true" />}
    </ToolbarPrimitive.Button>
  );
}

/**
 * An action on the selection, in the bar's arrow-key order. It is an extra-small ghost `Button`
 * unless `render` gives another control.
 */
export function ActionBarButton(props: ActionBarButtonProps): ReactElement {
  return (
    <ToolbarPrimitive.Button
      data-slot="action-bar-button"
      render={<Button variant="ghost" size="xs" />}
      {...props}
    />
  );
}

/** An `ActionBar.Button`'s words, visually hidden while the bar's container is narrower than 28rem. */
export function ActionBarButtonLabel({ className, ...props }: ActionBarButtonLabelProps): ReactElement {
  return (
    <span data-slot="action-bar-button-label" className={cn(slots.buttonLabel(), className)} {...props} />
  );
}

/** Toolbar's hairline between the bar's items, such as between the count and the actions. */
export function ActionBarSeparator({ className, ...props }: ActionBarSeparatorProps): ReactElement {
  return (
    <ToolbarPrimitive.Separator
      data-slot="action-bar-separator"
      className={mergeClassName(className, slots.separator())}
      {...props}
    />
  );
}

ActionBarRoot.displayName = "ActionBar.Root";
ActionBarCount.displayName = "ActionBar.Count";
ActionBarClear.displayName = "ActionBar.Clear";
ActionBarButton.displayName = "ActionBar.Button";
ActionBarButtonLabel.displayName = "ActionBar.ButtonLabel";
ActionBarSeparator.displayName = "ActionBar.Separator";
