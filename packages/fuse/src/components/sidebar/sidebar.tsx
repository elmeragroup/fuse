"use client";

import type {
  ComponentProps,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
  SetStateAction,
} from "react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { useIsMobile } from "../../hooks/use-is-mobile";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useStableCallback } from "../../hooks/use-stable-callback";
import { SidebarSimple } from "../../icons/generated/sidebar-simple";
import { ariaDisabledGuard } from "../../internal/aria-disabled-guard";
import { definedProps } from "../../internal/defined-props";
import { isTextEntry } from "../../internal/text-entry";
import { cn } from "../../styles/cn";
import { sidebarMenuActionShellClass } from "../../styles/inner-corner/sidebar";
import { mergeClassName } from "../../styles/merge-class-name";
import { nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { Button } from "../button/button";
import type { ButtonProps } from "../button/button";
import { InputControl } from "../input/input";
import { inputVariants } from "../input/input-class";
import { OverlayCloseButton } from "../overlay/overlay-close-button";
import { Separator } from "../separator/separator";
import type { SeparatorProps } from "../separator/separator";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetRoot,
  SheetTitle,
} from "../sheet/sheet";
import { Skeleton } from "../skeleton/skeleton";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "../tooltip/tooltip";
import type { TooltipContentProps } from "../tooltip/tooltip";
import { sidebarStrings } from "./intl";
import {
  sidebarContentClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarGroupLabelClass,
  sidebarIconClass,
  sidebarInputClass,
  sidebarInsetClass,
  sidebarMenuBadgeClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarMenuSkeletonClass,
  sidebarMenuSkeletonIconClass,
  sidebarMenuSkeletonTextClass,
  sidebarMenuSubClass,
  sidebarMenuSubItemClass,
  sidebarRailClass,
  sidebarSectionClass,
  sidebarSeparatorClass,
  sidebarTriggerClass,
} from "./sidebar-class";
import {
  sidebarGroupActionBoxClass,
  sidebarMenuButtonVariants,
  sidebarMenuActionBoxClass,
  sidebarMenuSubButtonVariants,
  sidebarPanelVariants,
  sidebarWrapperVariants,
} from "./sidebar-variants";
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON, SIDEBAR_WIDTH_MOBILE } from "./sidebar-width";

/**
 * The cookie a page Sidebar writes its open state to. Keep the colon: the funnel `layout.tsx`
 * reads `cookieStore.get("sidebar:state")` on the server for the first paint, so the shadcn
 * template's underscore name would break it without an error.
 */
export const SIDEBAR_COOKIE_NAME = "sidebar:state";
/** Cookie lifetime in seconds: seven days. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
/**
 * Key that toggles the sidebar together with the platform's command modifier: ⌘ (`metaKey`) on
 * Apple platforms, where Ctrl+B moves the caret, and Ctrl (`ctrlKey`) elsewhere.
 */
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";

/** Apple platforms, where ⌘ is the command modifier and Ctrl+B moves the caret back. */
const APPLE_PLATFORM = /mac|iphone|ipad|ipod/iu;

/**
 * Whether a keydown is the sidebar shortcut: B with the platform's command modifier alone, not
 * already handled by another listener, not mid-composition and not typed into a text field, so
 * an editor's own ⌘B (bold) and the caret keys keep working. Reads the platform per event, so
 * the server render never touches `navigator`.
 */
function isSidebarShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey) {
    return false;
  }
  if (event.key !== SIDEBAR_KEYBOARD_SHORTCUT) {
    return false;
  }
  const isApple = APPLE_PLATFORM.test(navigator.platform);
  const hasCommandModifier = isApple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return hasCommandModifier && !isTextEntry(event.target);
}

export type SidebarContextValue = {
  /** `expanded` while `open` is true, `collapsed` otherwise. */
  state: "expanded" | "collapsed";
  /** The desktop open state, controlled or the Provider's own. */
  open: boolean;
  /**
   * Accepts a boolean or an updater. At `bounds="page"` it writes the cookie on every call,
   * controlled or not; at `bounds="container"` it never does.
   */
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  /** The mobile Sheet's open state, controlled or the Provider's own. It lasts for the session only. */
  openMobile: boolean;
  /**
   * Accepts a boolean or an updater, as a React state setter does. When the Provider takes
   * `openMobile`, it reports the request through `onOpenMobileChange` instead.
   */
  setOpenMobile: Dispatch<SetStateAction<boolean>>;
  /** Whether the viewport is below 768px. It is `false` on the server and the first client render. */
  isMobile: boolean;
  /** Toggles `openMobile` on mobile and `open` on desktop. */
  toggleSidebar: () => void;
};

/** The toggle label and the mobile Sheet's title and description. */
export type SidebarLabels = {
  toggle: string;
  title: string;
  description: string;
};

/** What bounds a Sidebar; see `Sidebar.Provider`'s `bounds` prop. */
export type SidebarBounds = "page" | "container";

type SidebarInternalContextValue = {
  value: SidebarContextValue;
  labels: SidebarLabels;
  bounds: SidebarBounds;
};

const SidebarContext = createContext<SidebarInternalContextValue | null>(null);

function useSidebarInternal(): SidebarInternalContextValue {
  const context = use(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

/**
 * Reads the Provider's desktop and mobile open state and its setters, such as `toggleSidebar` for a
 * trigger of your own. It throws outside `Sidebar.Provider`.
 */
export function useSidebar(): SidebarContextValue {
  return useSidebarInternal().value;
}

/**
 * Resolves a boolean-or-updater request to the open state it asks for. Updaters within one event
 * compose from the last request; the next event starts from committed state again, so a parent
 * that controls the state may reject every request without causing another render. React's own
 * setter queues updaters instead, so the uncontrolled phone Sheet passes them to it untouched. The
 * desktop setter resolves even uncontrolled requests here, because its cookie needs the value.
 */
function useOpenRequests(open: boolean): (value: SetStateAction<boolean>) => boolean {
  // Resolves against committed state only: a suspended or abandoned render must not change how
  // the visible controls behave.
  const committed = useRef(open);
  useLayoutEffect(() => {
    committed.current = open;
  });
  const pending = useRef<boolean | undefined>(undefined);

  return useCallback((value: SetStateAction<boolean>) => {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- updater-or-boolean is the setter contract
    const next = typeof value === "function" ? value(pending.current ?? committed.current) : value;
    if (pending.current === undefined) {
      queueMicrotask(() => {
        pending.current = undefined;
      });
    }
    pending.current = next;
    return next;
  }, []);
}

export type SidebarProviderProps = ComponentProps<"div"> & {
  /**
   * The desktop open state on first render. The Provider reads it once, so a later value changes
   * nothing. A page Sidebar writes its state to the `sidebar:state` cookie on every change. To
   * restore it without a flash, read that cookie in a server layout with `cookies()` and pass it
   * here. A value read on the client arrives after hydration, which renders the server's value,
   * so a client-only read has to control `open` instead.
   */
  defaultOpen?: boolean;
  /** The desktop open state, for a Sidebar you control. */
  open?: boolean;
  /**
   * Called with the requested desktop open state. When you pass it, the Provider keeps no state
   * of its own. At `bounds="page"` it still writes the cookie on every change.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * The open state of the Sheet the Root becomes below 768px, so a host can close it from outside,
   * such as after a navigation. It lasts for the session only and is never written to the cookie.
   * Uncontrolled, it starts closed.
   */
  openMobile?: boolean;
  /**
   * Called with the requested Sheet state when the Trigger, the shortcut, the Sheet's own
   * dismissal or `useSidebar().setOpenMobile` asks to open or close it. When you pass it, the
   * Provider keeps no Sheet state of its own, and the host decides.
   */
  onOpenMobileChange?: (open: boolean) => void;
  /**
   * What bounds the Sidebar. `page` fills at least the viewport's height, fixes the desktop rail
   * to the viewport, writes the open state to the `sidebar:state` cookie and toggles on ⌘B or
   * Ctrl+B from anywhere in the document. `container` fills its container's height, which the
   * host must define, keeps the rail inside it, writes no cookie, so a host that wants the state
   * kept passes `open` and `onOpenChange`, and toggles on the shortcut only from a keydown inside
   * the Provider's React tree, so a page Sidebar around it keeps the shortcut everywhere else. An
   * `Inset` taller than the container is clipped, so the host scrolls the inset's own content. The
   * mobile Sheet still follows the viewport's width.
   */
  bounds?: SidebarBounds;
  /**
   * Text for the Trigger's and Rail's label and the mobile Sheet's screen reader title and
   * description. Each one left out comes from the locale dictionary's `sidebar.*` entries.
   */
  labels?: Partial<SidebarLabels>;
};

/**
 * Holds the open state, writes it to the `sidebar:state` cookie and toggles it on ⌘B on Apple
 * platforms and Ctrl+B elsewhere. The shortcut ignores a keydown another handler already
 * prevented, one mid-composition and one typed into a text field.
 */
export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  openMobile: openMobileProp,
  onOpenMobileChange,
  labels: labelsProp,
  bounds = "page",
  className,
  style,
  children,
  ...props
}: SidebarProviderProps): ReactElement {
  const strings = useLocalizedStrings(sidebarStrings);
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const requestOpen = useOpenRequests(open);
  const [internalOpenMobile, setInternalOpenMobile] = useState(false);
  const openMobile = openMobileProp ?? internalOpenMobile;
  const requestOpenMobile = useOpenRequests(openMobile);

  // Stable handlers read only committed props and responsive state. Suspended or
  // abandoned renders must not change how the visible controls behave.
  const latest = useRef({ isMobile, setOpenProp, onOpenMobileChange, bounds });
  useLayoutEffect(() => {
    latest.current = { isMobile, setOpenProp, onOpenMobileChange, bounds };
  });

  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = requestOpen(value);
      (latest.current.setOpenProp ?? setInternalOpen)(openState);
      // The cookie is the page's: a contained Sidebar's state belongs to its host.
      if (latest.current.bounds === "page") {
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      }
    },
    [requestOpen]
  );

  // No cookie to write, so uncontrolled updaters keep React's queue.
  const setOpenMobile = useCallback(
    (value: SetStateAction<boolean>) => {
      const report = latest.current.onOpenMobileChange;
      if (report) {
        report(requestOpenMobile(value));
      } else {
        setInternalOpenMobile(value);
      }
    },
    [requestOpenMobile]
  );

  const toggleSidebar = useCallback(() => {
    if (latest.current.isMobile) {
      setOpenMobile((current) => !current);
      return;
    }
    setOpen((current) => !current);
  }, [setOpen, setOpenMobile]);

  // Reads the native event and cancels `cancelable`: a React caller passes its synthetic event,
  // since only that one updates what React ancestors see as `defaultPrevented`.
  const handleShortcut = useStableCallback(
    (event: KeyboardEvent, cancelable: Pick<KeyboardEvent, "preventDefault"> = event) => {
      if (isSidebarShortcut(event)) {
        cancelable.preventDefault();
        toggleSidebar();
      }
    }
  );

  useEffect(() => {
    if (bounds !== "page") {
      return;
    }

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [bounds, handleShortcut]);

  // A contained Sidebar hears the shortcut on its wrapper, as React bubbles it: from its own
  // descendants and from overlays it portals, such as its mobile Sheet, and never from the rest
  // of the page.
  const handleContainedKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) =>
    handleShortcut(event.nativeEvent, event);

  const state = open ? "expanded" : "collapsed";

  const toggleLabel = labelsProp?.toggle ?? strings.format("toggle");
  const titleLabel = labelsProp?.title ?? strings.format("title");
  const descriptionLabel = labelsProp?.description ?? strings.format("description");

  const contextValue = useMemo<SidebarInternalContextValue>(
    () => ({
      value: { state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar },
      labels: { toggle: toggleLabel, title: titleLabel, description: descriptionLabel },
      bounds,
    }),
    [
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      toggleLabel,
      titleLabel,
      descriptionLabel,
      bounds,
    ]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={{
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          ...style,
        }}
        className={cn(sidebarWrapperVariants({ bounds }), className)}
        // The caller's handler runs first and may prevent the shortcut.
        {...mergeProps<"div">({ onKeyDown: bounds === "page" ? undefined : handleContainedKeyDown }, props)}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export type SidebarRootProps = Omit<ComponentProps<"div">, "style" | "children"> & {
  /**
   * The edge the rail sits on. The root writes it as `data-side`. For `right`, keep the Root
   * before `Sidebar.Inset` and pass `className="flex-row-reverse"` to `Sidebar.Provider`, so the
   * rail's spacer moves to the right edge and the Inset still reads the Root's state.
   */
  side?: "left" | "right";
  /**
   * The rail style. `sidebar` sits flush with the edge behind a border. `floating` pads the rail
   * and rounds and shadows its surface. `inset` pads the rail and shows the `Sidebar.Inset` beside
   * it as a card.
   */
  variant?: "sidebar" | "floating" | "inset";
  /**
   * How the rail collapses. `offcanvas` slides it off the edge, `icon` narrows it to
   * `--sidebar-width-icon` with only the icons showing, and `none` keeps it open. A `none` root
   * still writes `data-state`, `data-variant` and `data-side` for an `inset` layout.
   */
  collapsible?: "offcanvas" | "icon" | "none";
  /** The text direction of the mobile Sheet, such as `rtl`. */
  dir?: string;
  /**
   * Inline styles. The root's element props land on a different element in each layout: the rail
   * container on desktop, the Sheet's dialog below 768px and the root `div` with
   * `collapsible="none"`. In the Sheet, `style` merges over the mobile `--sidebar-width`, so it can
   * set the Sheet's width.
   */
  style?: ComponentProps<"div">["style"];
  /**
   * The rail's sections: `Sidebar.Header`, `Sidebar.Content`, `Sidebar.Footer` and
   * `Sidebar.Rail`. Below 768px they show in a Sheet, under a close button.
   */
  children?: ComponentProps<"div">["children"];
};

/**
 * The rail. On desktop it is fixed to the viewport or, under a `bounds="container"` Provider,
 * placed in the Provider's box. Below 768px it is a Sheet.
 */
export function SidebarRoot({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  style,
  children,
  dir,
  ...props
}: SidebarRootProps): ReactElement {
  const { value, labels, bounds } = useSidebarInternal();
  const { isMobile, state, openMobile, setOpenMobile } = value;
  const panel = sidebarPanelVariants({ variant, bounds });

  if (collapsible === "none") {
    // This differs from the shadcn template. The funnel's inset wizard dialogs rely on a sibling
    // Inset's `peer-data-[variant=inset]:` and the wrapper's `has-data-[variant=inset]:`, so this
    // branch keeps `group peer` and `data-state`, `data-variant` and `data-side`.
    return (
      <div
        data-slot="sidebar"
        data-state={state}
        data-variant={variant}
        data-side={side}
        className={panel.staticRoot({ className })}
        style={style}
        {...props}>
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      // SheetRoot renders only a provider, so the element props go to the popup.
      <SheetRoot side={side} open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          dir={dir}
          data-slot="sidebar"
          data-mobile="true"
          showCloseButton={false}
          className={cn("w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground", className)}
          {...props}
          style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE, ...style }}>
          <SheetHeader className="sr-only">
            <SheetTitle>{labels.title}</SheetTitle>
            <SheetDescription>{labels.description}</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">
            {/* The close sits in a normal-flow header row rather than absolute over the
                content, so no section reserves a magic offset for it. */}
            <div className="flex shrink-0 justify-end p-2">
              <SheetClose render={<OverlayCloseButton />} />
            </div>
            <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
          </div>
        </SheetContent>
      </SheetRoot>
    );
  }

  return (
    <div
      className={panel.root()}
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar">
      <div data-slot="sidebar-gap" className={panel.gap()} />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={panel.container({ className })}
        style={style}
        {...props}>
        <div
          data-slot="sidebar-inner"
          // `invisible`, not `inert`: Rail opts back in with `visible` (see SidebarRail).
          className={panel.inner()}>
          {children}
        </div>
      </div>
    </div>
  );
}

export type SidebarTriggerProps = ButtonProps & {
  /** The trigger's accessible name. Unset, it is the locale dictionary's `sidebar.toggle`. */
  "aria-label"?: string;
};

/**
 * The icon button that toggles the Sidebar. It names the keyboard shortcut in
 * `aria-keyshortcuts`, and an `aria-keyshortcuts` you pass replaces it.
 */
export function SidebarTrigger({
  className,
  onClick,
  variant = "ghost",
  "aria-label": ariaLabel,
  ...props
}: SidebarTriggerProps): ReactElement {
  const { value, labels } = useSidebarInternal();

  return (
    <Button
      data-slot="sidebar-trigger"
      aria-label={ariaLabel ?? labels.toggle}
      // Both modifiers: the server render cannot know the platform. The Provider honours ⌘B on
      // Apple platforms and Ctrl+B elsewhere.
      aria-keyshortcuts="Meta+B Control+B"
      {...definedProps(props)}
      variant={variant}
      size="icon-sm"
      className={cn(sidebarTriggerClass, className)}
      onClick={(event) => {
        onClick?.(event);
        value.toggleSidebar();
      }}>
      <SidebarSimple />
      <span className="sr-only">{labels.toggle}</span>
    </Button>
  );
}

export type SidebarRailProps = ComponentProps<"button">;

/**
 * The strip along the rail's inner edge that toggles the Sidebar on click, for the pointer only.
 * The collapsed offcanvas panel is `visibility: hidden`, which keeps it out of the accessibility
 * tree and the tab order, and the rail's `visible` paints it and makes it clickable again. The
 * panel does not use `inert`, because a descendant cannot undo it.
 */
export function SidebarRail({ className, ...props }: SidebarRailProps): ReactElement {
  const { value, labels } = useSidebarInternal();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      aria-hidden
      tabIndex={-1}
      title={labels.toggle}
      className={cn(sidebarRailClass, className)}
      {...mergeProps<"button">({ onClick: value.toggleSidebar }, props)}
    />
  );
}

export type SidebarInsetProps = Omit<useRender.ComponentProps<"main">, "render"> & {
  /**
   * The element the column renders. Unset, it is a `<main>` landmark. A layout that already has
   * its own `<main>` passes `<div />`, and the column keeps its slot and its card look beside an
   * `inset` rail.
   */
  render?: useRender.ComponentProps<"main">["render"];
};

/** The main column beside the Sidebar. */
export function SidebarInset({ className, render, ...props }: SidebarInsetProps): ReactElement {
  return useRender({
    defaultTagName: "main",
    props: mergeProps<"main">(
      {
        className: cn(sidebarInsetClass, className),
      },
      props
    ),
    render,
    state: { slot: "sidebar-inset" },
  });
}

/**
 * The props of `Sidebar.Input`, a native input's. It takes a string `className`, not Base UI
 * Input's state function, which `cn` cannot merge, and it keeps the native numeric `size`
 * attribute.
 */
export type SidebarInputProps = ComponentProps<"input">;

/**
 * A search field for the rail, such as in `Sidebar.Header`. It uses Input's control, so the
 * shared focus ring comes with the field box. It is a rail row, `--row-h` tall, with the md inset
 * and type, and takes no field size.
 */
export function SidebarInput({ className, ...props }: SidebarInputProps): ReactElement {
  return (
    <InputControl
      data-slot="sidebar-input"
      className={cn(inputVariants(), sidebarInputClass, className)}
      {...props}
    />
  );
}

export type SidebarHeaderProps = ComponentProps<"div">;

/**
 * The Sidebar header. In a floating Sidebar it publishes `--inner-corner` for its rows, the surface
 * corner less its padding.
 */
export function SidebarHeader({ className, ...props }: SidebarHeaderProps): ReactElement {
  return <div data-slot="sidebar-header" className={cn(sidebarSectionClass, className)} {...props} />;
}

export type SidebarFooterProps = ComponentProps<"div">;

/**
 * The Sidebar footer. In a floating Sidebar it publishes `--inner-corner` for its rows, the surface
 * corner less its padding.
 */
export function SidebarFooter({ className, ...props }: SidebarFooterProps): ReactElement {
  return <div data-slot="sidebar-footer" className={cn(sidebarSectionClass, className)} {...props} />;
}

export type SidebarSeparatorProps = SeparatorProps;

/** A line between two groups of the rail. */
export function SidebarSeparator({ className, ...props }: SidebarSeparatorProps): ReactElement {
  return (
    <Separator
      data-slot="sidebar-separator"
      className={mergeClassName(className, sidebarSeparatorClass)}
      {...props}
    />
  );
}

export type SidebarContentProps = ComponentProps<"div">;

/** The rail's scrolling body, between the header and the footer. */
export function SidebarContent({ className, ...props }: SidebarContentProps): ReactElement {
  return <div data-slot="sidebar-content" className={cn(sidebarContentClass, className)} {...props} />;
}

export type SidebarGroupProps = ComponentProps<"div">;

/**
 * A Sidebar group. In a floating Sidebar it publishes `--inner-corner` for its menu buttons and
 * label, the surface corner less its padding.
 */
export function SidebarGroup({ className, ...props }: SidebarGroupProps): ReactElement {
  return <div data-slot="sidebar-group" className={cn(sidebarGroupClass, className)} {...props} />;
}

export type SidebarGroupLabelProps = useRender.ComponentProps<"div">;

/** A group's heading. It hides in the collapsed icon rail. */
export function SidebarGroupLabel({ className, render, ...props }: SidebarGroupLabelProps): ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(sidebarGroupLabelClass, className),
      },
      props
    ),
    render,
    state: { slot: "sidebar-group-label" },
  });
}

export type SidebarGroupActionProps = useRender.ComponentProps<"button">;

/** A button at the end of a group's label, such as one that adds an item. Give it an `aria-label`. */
export function SidebarGroupAction({ className, render, ...props }: SidebarGroupActionProps): ReactElement {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          sidebarGroupActionBoxClass,
          "absolute right-3 flex items-center justify-center rounded-md p-0 text-sidebar-foreground transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
          selfFocusRingClass,
          nativeStateFaceClass,
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "sidebar-group-action" },
  });
}

export type SidebarGroupContentProps = ComponentProps<"div">;

/** A group's body, under its label. */
export function SidebarGroupContent({ className, ...props }: SidebarGroupContentProps): ReactElement {
  return (
    <div data-slot="sidebar-group-content" className={cn(sidebarGroupContentClass, className)} {...props} />
  );
}

export type SidebarMenuProps = ComponentProps<"ul">;

/** The list of menu items. */
export function SidebarMenu({ className, ...props }: SidebarMenuProps): ReactElement {
  return <ul data-slot="sidebar-menu" className={cn(sidebarMenuClass, className)} {...props} />;
}

export type SidebarMenuItemProps = ComponentProps<"li">;

/** One entry of a menu, holding a menu button and its action, badge or submenu. */
export function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps): ReactElement {
  return <li data-slot="sidebar-menu-item" className={cn(sidebarMenuItemClass, className)} {...props} />;
}

/** The props of `Sidebar.MenuButton`, a menu row. */
export type SidebarMenuButtonProps = Omit<useRender.ComponentProps<"button">, "aria-disabled"> & {
  /** The row style. `outline` gives the row a fill and a 1px ring in the sidebar border colour. */
  variant?: VariantProps<typeof sidebarMenuButtonVariants>["variant"];
  /**
   * The row height. `default` takes the density's row height, `sm` is 28px with smaller type, and
   * `lg` is 48px.
   */
  size?: VariantProps<typeof sidebarMenuButtonVariants>["size"];
  /**
   * Marks the current item. The row gets `data-active` and the accent fill. Pass
   * `aria-current="page"` on its link yourself.
   */
  isActive?: boolean;
  /**
   * The label to show beside the collapsed icon rail. The row becomes the tooltip's trigger, so
   * one element is the row, your `render` element and the trigger. The tooltip opens to the right
   * and only while the desktop rail is collapsed. A string is short for `{ children }`.
   */
  tooltip?: string | TooltipContentProps;
  /**
   * Pass `"true"` to make the row unavailable. It looks disabled but keeps pointer events, so its
   * tooltip still opens. A click or Enter neither follows its link nor runs `onClick`, and a
   * middle-click neither opens a new tab nor runs `onAuxClick`.
   */
  "aria-disabled"?: useRender.ComponentProps<"button">["aria-disabled"];
};

/**
 * The collapsed-rail tooltip. It reads the context, not `Sidebar.MenuButton`, so a menu button
 * without a `tooltip` does not re-render when the rail toggles. The root
 * is disabled, not unmounted, while the rail is expanded or on mobile: Base UI then closes
 * an open hover or focus state instead of keeping it for the collapse, and the trigger
 * element, with its focus, survives the toggle.
 */
function SidebarMenuButtonTooltip({
  trigger,
  content,
}: {
  trigger: ReactElement;
  content: TooltipContentProps;
}): ReactElement {
  const { isMobile, state } = useSidebar();
  return (
    <TooltipRoot disabled={state !== "collapsed" || isMobile}>
      {trigger}
      <TooltipContent side="right" align="center" {...content} />
    </TooltipRoot>
  );
}

/** A menu row, a `<button>` unless `render` passes a link. */
export function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps): ReactElement {
  const button = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      { className: cn(sidebarMenuButtonVariants({ variant, size }), className) },
      props,
      ariaDisabledGuard
    ),
    render: tooltip === undefined ? render : <TooltipTrigger render={render} />,
    state: { slot: "sidebar-menu-button", size, active: isActive },
  });

  if (tooltip === undefined) {
    return button;
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- string tooltip shorthand is the documented contract
  const contentProps: TooltipContentProps = typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return <SidebarMenuButtonTooltip trigger={button} content={contentProps} />;
}

export type SidebarMenuActionProps = useRender.ComponentProps<"button"> & {
  /**
   * Hides the action from 768px up until its menu item is hovered or holds focus, or the action
   * has `aria-expanded`, so an open dropdown keeps it in view.
   */
  showOnHover?: boolean;
};

/**
 * A button at the end of a menu row, such as a dropdown trigger. Give it an `aria-label`. It
 * hides in the collapsed icon rail.
 */
export function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: SidebarMenuActionProps): ReactElement {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          sidebarMenuActionShellClass,
          sidebarMenuActionBoxClass,
          "absolute right-1 flex items-center justify-center p-0 text-sidebar-foreground transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground after:absolute after:-inset-2 enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
          selfFocusRingClass,
          nativeStateFaceClass,
          showOnHover &&
            "md:opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100",
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "sidebar-menu-action" },
  });
}

export type SidebarMenuBadgeProps = ComponentProps<"div">;

/** A count at the end of a menu row. */
export function SidebarMenuBadge({ className, ...props }: SidebarMenuBadgeProps): ReactElement {
  return <div data-slot="sidebar-menu-badge" className={cn(sidebarMenuBadgeClass, className)} {...props} />;
}

export type SidebarMenuSkeletonProps = ComponentProps<"div"> & {
  /** Draws a square icon placeholder before the text bar. */
  showIcon?: boolean;
};

/**
 * A placeholder menu row while items load. CSS sets the text bar's width: `--skeleton-width`
 * cycles five values from 50% to 90% by the row's `:nth-child` position, so the server and the
 * client render the same DOM. The shadcn template picked a random width per mount, which could
 * not hydrate.
 */
export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: SidebarMenuSkeletonProps): ReactElement {
  return (
    <div data-slot="sidebar-menu-skeleton" className={cn(sidebarMenuSkeletonClass, className)} {...props}>
      {showIcon ? (
        <Skeleton className={sidebarMenuSkeletonIconClass} data-slot="sidebar-menu-skeleton-icon" />
      ) : null}
      <Skeleton className={sidebarMenuSkeletonTextClass} data-slot="sidebar-menu-skeleton-text" />
    </div>
  );
}

export type SidebarMenuSubProps = ComponentProps<"ul">;

/** A nested list under a menu item. It hides in the collapsed icon rail. */
export function SidebarMenuSub({ className, ...props }: SidebarMenuSubProps): ReactElement {
  return <ul data-slot="sidebar-menu-sub" className={cn(sidebarMenuSubClass, className)} {...props} />;
}

export type SidebarMenuSubItemProps = ComponentProps<"li">;

/** One entry of a submenu. */
export function SidebarMenuSubItem({ className, ...props }: SidebarMenuSubItemProps): ReactElement {
  return (
    <li data-slot="sidebar-menu-sub-item" className={cn(sidebarMenuSubItemClass, className)} {...props} />
  );
}

/** The props of `Sidebar.MenuSubButton`, a submenu row. */
export type SidebarMenuSubButtonProps = Omit<useRender.ComponentProps<"a">, "aria-disabled"> & {
  /**
   * The row size, written as `data-size`. `md` takes the md control height and the density's
   * type, and `sm` the sm control height and `text-sm`.
   */
  size?: "sm" | "md";
  /** Marks the current item. The row gets `data-active` and the accent fill. */
  isActive?: boolean;
  /**
   * Pass `"true"` to make the row unavailable. It looks disabled, a click or Enter neither
   * follows its link nor runs `onClick`, and a middle-click neither opens a new tab nor runs
   * `onAuxClick`.
   */
  "aria-disabled"?: useRender.ComponentProps<"a">["aria-disabled"];
};

/** A submenu row, an `<a>` unless `render` passes another element. */

export function SidebarMenuSubButton({
  render,
  size = "md",
  isActive = false,
  className,
  ...props
}: SidebarMenuSubButtonProps): ReactElement {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(sidebarMenuSubButtonVariants({ size }), className),
      },
      props,
      ariaDisabledGuard
    ),
    render,
    state: { slot: "sidebar-menu-sub-button", size, active: isActive },
  });
}

export type SidebarIconProps = ComponentProps<"div">;

/**
 * Centres a brand mark in the footer, full width in the collapsed icon rail. The shadcn template
 * has no such part.
 */
export function SidebarIcon({ className, ...props }: SidebarIconProps): ReactElement {
  return <div data-slot="sidebar-icon" className={cn(sidebarIconClass, className)} {...props} />;
}

SidebarProvider.displayName = "Sidebar.Provider";
SidebarRoot.displayName = "Sidebar.Root";
SidebarTrigger.displayName = "Sidebar.Trigger";
SidebarRail.displayName = "Sidebar.Rail";
SidebarInset.displayName = "Sidebar.Inset";
SidebarInput.displayName = "Sidebar.Input";
SidebarHeader.displayName = "Sidebar.Header";
SidebarFooter.displayName = "Sidebar.Footer";
SidebarSeparator.displayName = "Sidebar.Separator";
SidebarContent.displayName = "Sidebar.Content";
SidebarGroup.displayName = "Sidebar.Group";
SidebarGroupLabel.displayName = "Sidebar.GroupLabel";
SidebarGroupAction.displayName = "Sidebar.GroupAction";
SidebarGroupContent.displayName = "Sidebar.GroupContent";
SidebarMenu.displayName = "Sidebar.Menu";
SidebarMenuItem.displayName = "Sidebar.MenuItem";
SidebarMenuButton.displayName = "Sidebar.MenuButton";
SidebarMenuAction.displayName = "Sidebar.MenuAction";
SidebarMenuBadge.displayName = "Sidebar.MenuBadge";
SidebarMenuSkeleton.displayName = "Sidebar.MenuSkeleton";
SidebarMenuSub.displayName = "Sidebar.MenuSub";
SidebarMenuSubItem.displayName = "Sidebar.MenuSubItem";
SidebarMenuSubButton.displayName = "Sidebar.MenuSubButton";
SidebarIcon.displayName = "Sidebar.Icon";
