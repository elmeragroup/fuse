"use client";

import type { ComponentProps, Dispatch, ReactElement, SetStateAction } from "react";
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
import { SidebarSimple } from "../../icons/generated/sidebar-simple";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { Button } from "../button/button";
import type { ButtonProps } from "../button/button";
import { Input } from "../input/input";
import { OverlayCloseButton } from "../overlay/overlay-close-button";
import { Separator } from "../separator/separator";
import type { SeparatorProps } from "../separator/separator";
import { Sheet } from "../sheet/sheet";
import { Skeleton } from "../skeleton/skeleton";
import { Tooltip } from "../tooltip/tooltip";
import type { TooltipContentProps } from "../tooltip/tooltip";
import { sidebarStrings } from "./intl";
import { sidebarMenuButtonVariants, sidebarMenuSubButtonVariants } from "./sidebar-variants";

/**
 * Cookie the open state persists to. HARD invariant: the funnel
 * `layout.tsx` server-reads `cookieStore.get("sidebar:state")` for SSR open-state, so the
 * shadcn template's underscore-separated name would silently break it.
 */
export const SIDEBAR_COOKIE_NAME = "sidebar:state";
/** Cookie lifetime in seconds: seven days. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
/** Desktop rail width, applied as `--sidebar-width` on the Provider wrapper. */
export const SIDEBAR_WIDTH = "16rem";
/** Mobile Sheet override of `--sidebar-width`. */
export const SIDEBAR_WIDTH_MOBILE = "18rem";
/** Icon-collapsed rail width, applied as `--sidebar-width-icon` on the Provider wrapper. */
export const SIDEBAR_WIDTH_ICON = "3rem";
/** Key that toggles the sidebar together with `metaKey` or `ctrlKey` (cmd/ctrl+B). */
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";

export type SidebarContextValue = {
  /** Derived from `open`. */
  state: "expanded" | "collapsed";
  /** Desktop open state — controlled or internal. */
  open: boolean;
  /** Writes the cookie on every call, controlled or not; accepts a boolean or an updater. */
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  /** Mobile Sheet state; session-only, never cookie-persisted. */
  openMobile: boolean;
  /** React state setter for `openMobile`. */
  setOpenMobile: Dispatch<SetStateAction<boolean>>;
  /** From the package-private viewport probe; `false` on the server and first client render. */
  isMobile: boolean;
  /** Toggles `openMobile` on mobile, `setOpen(o => !o)` on desktop. */
  toggleSidebar: () => void;
};

/** Toggle, title and description copy; the dictionary defaults unless overridden. */
export type SidebarLabels = {
  toggle: string;
  title: string;
  description: string;
};

type SidebarInternalContextValue = {
  value: SidebarContextValue;
  labels: SidebarLabels;
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
 * The Provider's open/mobile state and toggle. Throws outside
 * `Sidebar.Provider`.
 */
export function useSidebar(): SidebarContextValue {
  return useSidebarInternal().value;
}

export type SidebarProviderProps = ComponentProps<"div"> & {
  /**
   * Uncontrolled initial open state. SSR pattern: parse the `sidebar:state` cookie
   * server-side and pass it here.
   * @default true
   */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /**
   * Controlled setter. When provided, internal state is bypassed but the cookie is still
   * written on every change.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Copy overrides for the Trigger/Rail label and the mobile Sheet's sr-only title and
   * description. Defaults to the locale dictionary (`sidebar.*`).
   */
  labels?: Partial<SidebarLabels>;
};

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  labels: labelsProp,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps): ReactElement {
  const strings = useLocalizedStrings(sidebarStrings);
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;

  // Stable handlers read only committed props and responsive state. Suspended or
  // abandoned renders must not change how the visible controls behave.
  const latest = useRef({ open, isMobile, setOpenProp });
  useLayoutEffect(() => {
    latest.current = { open, isMobile, setOpenProp };
  });
  const pendingOpen = useRef<boolean | undefined>(undefined);

  const setOpen = useCallback((value: boolean | ((value: boolean) => boolean)) => {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- updater-or-boolean is the setter contract
    const openState = typeof value === "function" ? value(pendingOpen.current ?? latest.current.open) : value;
    if (pendingOpen.current === undefined) {
      // Compose requests within this event, then return authority to committed state.
      // A controlled parent may reject every request without causing another render.
      queueMicrotask(() => {
        pendingOpen.current = undefined;
      });
    }
    pendingOpen.current = openState;
    const onOpenChange = latest.current.setOpenProp;

    if (onOpenChange) {
      onOpenChange(openState);
    } else {
      setInternalOpen(openState);
    }

    document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  }, []);

  const toggleSidebar = useCallback(() => {
    if (latest.current.isMobile) {
      setOpenMobile((current) => !current);
      return;
    }
    setOpen((current) => !current);
  }, [setOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleSidebar]);

  const state = open ? "expanded" : "collapsed";

  const toggleLabel = labelsProp?.toggle ?? strings.format("toggle");
  const titleLabel = labelsProp?.title ?? strings.format("title");
  const descriptionLabel = labelsProp?.description ?? strings.format("description");

  const contextValue = useMemo<SidebarInternalContextValue>(
    () => ({
      value: { state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar },
      labels: { toggle: toggleLabel, title: titleLabel, description: descriptionLabel },
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar, toggleLabel, titleLabel, descriptionLabel]
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
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
          className
        )}
        {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export type SidebarRootProps = ComponentProps<"div"> & {
  /**
   * Edge the rail anchors to. Emitted as `data-side`; drives gap rotation, container
   * offsets, border side and rail cursors.
   * @default "left"
   */
  side?: "left" | "right";
  /**
   * `floating` pads the rail and rounds/shadows the inner surface; `inset` pads the rail
   * and lets the sibling `Sidebar.Inset` react through peer selectors; `sidebar` is flush
   * with an edge border.
   * @default "sidebar"
   */
  variant?: "sidebar" | "floating" | "inset";
  /**
   * `offcanvas` slides the rail off-screen when collapsed; `icon` collapses to
   * `--sidebar-width-icon`; `none` renders the static branch — which still emits
   * `group peer` and `data-state/variant/side` for inset compositions.
   * @default "offcanvas"
   */
  collapsible?: "offcanvas" | "icon" | "none";
  /** Text direction, forwarded to the mobile Sheet content (RTL). */
  dir?: string;
};

function SidebarRoot({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  dir,
  ...props
}: SidebarRootProps): ReactElement {
  const { value, labels } = useSidebarInternal();
  const { isMobile, state, openMobile, setOpenMobile } = value;

  if (collapsible === "none") {
    // Funnel deviation from the shadcn template: the inset wizard dialogs
    // rely on a sibling Inset's `peer-data-[variant=inset]:` and the wrapper's
    // `has-data-[variant=inset]:`, so this branch keeps group/peer + data-state/variant/side.
    return (
      <div
        data-slot="sidebar"
        data-state={state}
        data-variant={variant}
        data-side={side}
        className={cn(
          "group peer flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className
        )}
        {...props}>
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet.Root side={side} open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <Sheet.Content
          dir={dir}
          data-slot="sidebar"
          data-mobile="true"
          showCloseButton={false}
          className={cn("w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground", className)}
          style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE }}>
          <Sheet.Header className="sr-only">
            <Sheet.Title>{labels.title}</Sheet.Title>
            <Sheet.Description>{labels.description}</Sheet.Description>
          </Sheet.Header>
          <div className="flex h-full w-full flex-col">
            {/* The close sits in a normal-flow header row rather than absolute over the
                content, so no section reserves a magic offset for it. */}
            <div className="flex shrink-0 justify-end p-2">
              <Sheet.Close render={<OverlayCloseButton />} />
            </div>
            <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
          </div>
        </Sheet.Content>
      </Sheet.Root>
    );
  }

  return (
    <div
      className="group peer md:block hidden text-sidebar-foreground"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar">
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          "md:flex fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}>
        <div
          data-slot="sidebar-inner"
          // `invisible`, not `inert`: Rail opts back in with `visible` (see SidebarRail).
          className="group-data-[variant=floating]:shadow-sm flex size-full flex-col bg-sidebar group-data-[collapsible=offcanvas]:invisible group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border">
          {children}
        </div>
      </div>
    </div>
  );
}

export type SidebarTriggerProps = ButtonProps & {
  /**
   * Accessible name for the icon-only trigger. Defaults to the locale
   * dictionary `sidebar.toggle`.
   */
  "aria-label"?: string;
};

function SidebarTrigger({
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
      {...props}
      variant={variant}
      size="icon-sm"
      aria-label={ariaLabel ?? labels.toggle}
      className={cn("hit-area-1", className)}
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
 * Reopen control. `visible` re-enables it under the collapsed offcanvas panel's
 * `visibility: hidden`: a hidden ancestor leaves it out of the accessibility tree and tab
 * order, but a `visible` descendant is painted and clickable again. (`inert` cannot be
 * undone from inside, which is why the panel does not use it.)
 */
function SidebarRail({ className, ...props }: SidebarRailProps): ReactElement {
  const { value, labels } = useSidebarInternal();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      aria-hidden
      tabIndex={-1}
      onClick={value.toggleSidebar}
      title={labels.toggle}
      className={cn(
        "sm:flex visible absolute inset-y-0 z-20 hidden w-4 group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] after:transition-colors hover:after:bg-sidebar-border ltr:-translate-x-1/2 rtl:-translate-x-1/2",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  );
}

export type SidebarInsetProps = ComponentProps<"main">;

function SidebarInset({ className, ...props }: SidebarInsetProps): ReactElement {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 relative flex w-full flex-1 flex-col bg-background",
        className
      )}
      {...props}
    />
  );
}

/**
 * Typed as `ComponentProps<"input">` (string `className`) rather than the base-ui Input's
 * props, whose `className` can be a render-prop function `cn` cannot merge.
 * Composes the library Input so the shared `focusRing` ships with the field box; `h-8` is
 * the shell-local density exemption.
 */
export type SidebarInputProps = ComponentProps<"input">;

function SidebarInput({ className, ...props }: SidebarInputProps): ReactElement {
  return (
    <Input
      data-slot="sidebar-input"
      className={cn("h-8 w-full bg-background shadow-none", className)}
      {...props}
    />
  );
}

export type SidebarHeaderProps = ComponentProps<"div">;

function SidebarHeader({ className, ...props }: SidebarHeaderProps): ReactElement {
  return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

export type SidebarFooterProps = ComponentProps<"div">;

function SidebarFooter({ className, ...props }: SidebarFooterProps): ReactElement {
  return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

export type SidebarSeparatorProps = SeparatorProps;

function SidebarSeparator({ className, ...props }: SidebarSeparatorProps): ReactElement {
  return (
    <Separator
      data-slot="sidebar-separator"
      className={mergeClassName(className, "mx-2 w-auto bg-sidebar-border")}
      {...props}
    />
  );
}

export type SidebarContentProps = ComponentProps<"div">;

function SidebarContent({ className, ...props }: SidebarContentProps): ReactElement {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

export type SidebarGroupProps = ComponentProps<"div">;

function SidebarGroup({ className, ...props }: SidebarGroupProps): ReactElement {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
}

export type SidebarGroupLabelProps = useRender.ComponentProps<"div">;

function SidebarGroupLabel({ className, render, ...props }: SidebarGroupLabelProps): ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "text-xs font-medium flex h-8 shrink-0 items-center rounded-md px-2 text-sidebar-foreground/70 transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0",
          selfFocusRingClass,
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "sidebar-group-label" },
  });
}

export type SidebarGroupActionProps = useRender.ComponentProps<"button">;

function SidebarGroupAction({ className, render, ...props }: SidebarGroupActionProps): ReactElement {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "absolute top-3.5 right-3 flex size-6 items-center justify-center rounded-md p-0 text-sidebar-foreground transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
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

function SidebarGroupContent({ className, ...props }: SidebarGroupContentProps): ReactElement {
  return <div data-slot="sidebar-group-content" className={cn("text-sm w-full", className)} {...props} />;
}

export type SidebarMenuProps = ComponentProps<"ul">;

function SidebarMenu({ className, ...props }: SidebarMenuProps): ReactElement {
  return (
    <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-0", className)} {...props} />
  );
}

export type SidebarMenuItemProps = ComponentProps<"li">;

function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps): ReactElement {
  return (
    <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} />
  );
}

export type SidebarMenuButtonProps = useRender.ComponentProps<"button"> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    /**
     * Current item. Emits `data-active` and the accent background/foreground; pair with
     * `aria-current="page"` at the call site.
     * @default false
     */
    isActive?: boolean;
    /**
     * Collapsed icon-mode label. The button becomes the tooltip trigger (one DOM node is the
     * menu button, the caller's `render` element and the trigger); the content sits on the
     * right and is only visible while the desktop rail is collapsed. A string is shorthand
     * for `{ children }`.
     */
    tooltip?: string | TooltipContentProps;
  };

/**
 * The collapsed-rail tooltip. It — not `Sidebar.MenuButton` — is the context consumer,
 * so a menu button without a `tooltip` does not re-render when the rail toggles
 */
function SidebarMenuButtonTooltip(contentProps: TooltipContentProps): ReactElement | null {
  const { isMobile, state } = useSidebar();
  if (state !== "collapsed" || isMobile) {
    return null;
  }

  return <Tooltip.Content side="right" align="center" {...contentProps} />;
}

function SidebarMenuButton({
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
      props
    ),
    render: tooltip === undefined ? render : <Tooltip.Trigger render={render} />,
    state: { slot: "sidebar-menu-button", size, active: isActive },
  });

  if (tooltip === undefined) {
    return button;
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- string tooltip shorthand is the documented contract
  const contentProps: TooltipContentProps = typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip.Root>
      {button}
      <SidebarMenuButtonTooltip {...contentProps} />
    </Tooltip.Root>
  );
}

export type SidebarMenuActionProps = useRender.ComponentProps<"button"> & {
  /**
   * Hides the action at `md:` and up until the menu item is hovered or focused within, or
   * the action reports `aria-expanded` (an open dropdown keeps it visible).
   * @default false
   */
  showOnHover?: boolean;
};

function SidebarMenuAction({
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
          "absolute top-1.5 right-1 flex size-6 items-center justify-center rounded-md p-0 text-sidebar-foreground transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
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

function SidebarMenuBadge({ className, ...props }: SidebarMenuBadgeProps): ReactElement {
  return (
    <div
      data-slot="sidebar-menu-badge"
      className={cn(
        "text-xs font-medium pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

export type SidebarMenuSkeletonProps = ComponentProps<"div"> & {
  /**
   * Renders a square icon placeholder before the text bar.
   * @default false
   */
  showIcon?: boolean;
};

/**
 * The text bar's width is CSS-deterministic: `--skeleton-width` cycles
 * five values in the 50–90% band by the parent row's `:nth-child` position, so two mounts
 * produce identical DOM and server and client agree — the ref randomized the width per mount,
 * a hydration mismatch by construction.
 */
function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: SidebarMenuSkeletonProps): ReactElement {
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 [--skeleton-width:70%] [:nth-child(5n)>&]:[--skeleton-width:55%] [:nth-child(5n+1)>&]:[--skeleton-width:50%] [:nth-child(5n+2)>&]:[--skeleton-width:90%] [:nth-child(5n+3)>&]:[--skeleton-width:65%] [:nth-child(5n+4)>&]:[--skeleton-width:80%]",
        className
      )}
      {...props}>
      {showIcon ? <Skeleton className="size-4 rounded-md" data-slot="sidebar-menu-skeleton-icon" /> : null}
      <Skeleton className="h-4 max-w-(--skeleton-width) flex-1" data-slot="sidebar-menu-skeleton-text" />
    </div>
  );
}

export type SidebarMenuSubProps = ComponentProps<"ul">;

function SidebarMenuSub({ className, ...props }: SidebarMenuSubProps): ReactElement {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  );
}

export type SidebarMenuSubItemProps = ComponentProps<"li">;

function SidebarMenuSubItem({ className, ...props }: SidebarMenuSubItemProps): ReactElement {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  );
}

export type SidebarMenuSubButtonProps = useRender.ComponentProps<"a"> & {
  /**
   * Row size, emitted as `data-size`. `md` pins the md control rung and the control-type
   * pair; `sm` pins the sm rung with size-owned `text-sm`.
   * @default "md"
   */
  size?: "sm" | "md";
  /**
   * Current item. Emits `data-active` and the accent background/foreground.
   * @default false
   */
  isActive?: boolean;
};

function SidebarMenuSubButton({
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
      props
    ),
    render,
    state: { slot: "sidebar-menu-sub-button", size, active: isActive },
  });
}

export type SidebarIconProps = ComponentProps<"div">;

/** Funnel addition (no shadcn equivalent): centers a brand mark in the footer, full width in icon mode. */
function SidebarIcon({ className, ...props }: SidebarIconProps): ReactElement {
  return (
    <div
      data-slot="sidebar-icon"
      className={cn(
        "flex items-center justify-center group-data-[collapsible=icon]:w-full [&_svg]:size-5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
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

export const Sidebar = {
  Provider: SidebarProvider,
  Root: SidebarRoot,
  Trigger: SidebarTrigger,
  Rail: SidebarRail,
  Inset: SidebarInset,
  Input: SidebarInput,
  Header: SidebarHeader,
  Footer: SidebarFooter,
  Separator: SidebarSeparator,
  Content: SidebarContent,
  Group: SidebarGroup,
  GroupLabel: SidebarGroupLabel,
  GroupAction: SidebarGroupAction,
  GroupContent: SidebarGroupContent,
  Menu: SidebarMenu,
  MenuItem: SidebarMenuItem,
  MenuButton: SidebarMenuButton,
  MenuAction: SidebarMenuAction,
  MenuBadge: SidebarMenuBadge,
  MenuSkeleton: SidebarMenuSkeleton,
  MenuSub: SidebarMenuSub,
  MenuSubItem: SidebarMenuSubItem,
  MenuSubButton: SidebarMenuSubButton,
  Icon: SidebarIcon,
};
