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
  sidebarWrapperClass,
} from "./sidebar-class";
import {
  sidebarGroupActionBoxClass,
  sidebarMenuButtonVariants,
  sidebarMenuActionBoxClass,
  sidebarMenuSubButtonVariants,
  sidebarPanelVariants,
} from "./sidebar-variants";
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON, SIDEBAR_WIDTH_MOBILE } from "./sidebar-width";

/**
 * Cookie the open state persists to. HARD invariant: the funnel
 * `layout.tsx` server-reads `cookieStore.get("sidebar:state")` for SSR open-state, so the
 * shadcn template's underscore-separated name would silently break it.
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

/**
 * Owns the open state, persists it to the `sidebar:state` cookie and toggles it on the keyboard
 * shortcut: ⌘B on Apple platforms and Ctrl+B elsewhere. The shortcut stands aside for a keydown
 * another handler already prevented, one mid-composition and one typed into a text field.
 */
export function SidebarProvider({
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
      if (isSidebarShortcut(event)) {
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
        className={cn(sidebarWrapperClass, className)}
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

/**
 * The sidebar surface. Its element props (`id`, `aria-*`, `data-*`, handlers, `style`)
 * land on a different element per branch:
 * - desktop: the fixed `sidebar-container`;
 * - mobile: the sheet dialog, with `style` merged over the mobile `--sidebar-width`, so a
 *   caller's `style` can override the width;
 * - `collapsible="none"`: the static root div.
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
  const { value, labels } = useSidebarInternal();
  const { isMobile, state, openMobile, setOpenMobile } = value;
  const panel = sidebarPanelVariants({ variant });

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
  /**
   * Accessible name for the icon-only trigger. Defaults to the locale
   * dictionary `sidebar.toggle`.
   */
  "aria-label"?: string;
};

/**
 * Icon button that toggles the sidebar. It declares the keyboard shortcut in
 * `aria-keyshortcuts`; a consumer value replaces it.
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
 * Reopen control. `visible` re-enables it under the collapsed offcanvas panel's
 * `visibility: hidden`: a hidden ancestor leaves it out of the accessibility tree and tab
 * order, but a `visible` descendant is painted and clickable again. (`inert` cannot be
 * undone from inside, which is why the panel does not use it.)
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

export type SidebarInsetProps = ComponentProps<"main">;

export function SidebarInset({ className, ...props }: SidebarInsetProps): ReactElement {
  return <main data-slot="sidebar-inset" className={cn(sidebarInsetClass, className)} {...props} />;
}

/**
 * Typed as `ComponentProps<"input">` (string `className`) rather than the base-ui Input's
 * props, whose `className` can be a render-prop function `cn` cannot merge.
 * Composes the library Input's control so the shared `focusRing` ships with the field box, and
 * keeps the native numeric `size` attribute. It is a row of the sidebar, so it is `--row-h` tall
 * and takes no field size prop; it writes the default one, so its inset and type are md.
 */
export type SidebarInputProps = ComponentProps<"input">;

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

export function SidebarGroupContent({ className, ...props }: SidebarGroupContentProps): ReactElement {
  return (
    <div data-slot="sidebar-group-content" className={cn(sidebarGroupContentClass, className)} {...props} />
  );
}

export type SidebarMenuProps = ComponentProps<"ul">;

export function SidebarMenu({ className, ...props }: SidebarMenuProps): ReactElement {
  return <ul data-slot="sidebar-menu" className={cn(sidebarMenuClass, className)} {...props} />;
}

export type SidebarMenuItemProps = ComponentProps<"li">;

export function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps): ReactElement {
  return <li data-slot="sidebar-menu-item" className={cn(sidebarMenuItemClass, className)} {...props} />;
}

/**
 * A menu row. Given `aria-disabled="true"`, the row looks disabled but keeps pointer events,
 * so its Tooltip still opens, and it cancels its own activation: a click or a keyboard Enter
 * neither follows a link nor runs `onClick`, and a middle-click neither opens a new tab nor
 * runs `onAuxClick`.
 */
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
 * so a menu button without a `tooltip` does not re-render when the rail toggles. The root
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
   * Hides the action at `md:` and up until the menu item is hovered or focused within, or
   * the action reports `aria-expanded` (an open dropdown keeps it visible).
   * @default false
   */
  showOnHover?: boolean;
};

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

export function SidebarMenuBadge({ className, ...props }: SidebarMenuBadgeProps): ReactElement {
  return <div data-slot="sidebar-menu-badge" className={cn(sidebarMenuBadgeClass, className)} {...props} />;
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

export function SidebarMenuSub({ className, ...props }: SidebarMenuSubProps): ReactElement {
  return <ul data-slot="sidebar-menu-sub" className={cn(sidebarMenuSubClass, className)} {...props} />;
}

export type SidebarMenuSubItemProps = ComponentProps<"li">;

export function SidebarMenuSubItem({ className, ...props }: SidebarMenuSubItemProps): ReactElement {
  return (
    <li data-slot="sidebar-menu-sub-item" className={cn(sidebarMenuSubItemClass, className)} {...props} />
  );
}

/**
 * A sub-menu row, an anchor by default. Given `aria-disabled="true"`, the row looks disabled
 * and cancels its own activation: a click or a keyboard Enter neither follows the link nor
 * runs `onClick`, and a middle-click neither opens a new tab nor runs `onAuxClick`.
 */
export type SidebarMenuSubButtonProps = useRender.ComponentProps<"a"> & {
  /**
   * Row size, emitted as `data-size`. `md` takes the md control size's height and the
   * density type pair; `sm` takes the sm control size's height and fixed `text-sm`.
   * @default "md"
   */
  size?: "sm" | "md";
  /**
   * Current item. Emits `data-active` and the accent background/foreground.
   * @default false
   */
  isActive?: boolean;
};

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

/** Funnel addition (no shadcn equivalent): centers a brand mark in the footer, full width in icon mode. */
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
