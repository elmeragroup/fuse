"use client";

import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";
import { createContext, use } from "react";

import { Drawer as SheetPrimitive } from "@base-ui/react/drawer";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { overlayLayer, overlayScrimClass } from "../overlay/overlay-classes";
import { overlayCornerCloseButton } from "../overlay/overlay-close-button";
import { sheetStrings } from "./intl";

/** Resolved once at module scope — the recipe below does the same (no per-render work). */
const selfFocusRing = focusRing({ target: "self" }).root();

/**
 * `side` → primitive `swipeDirection`. Swiping toward the anchored edge dismisses;
 * the mapping is the component's spine and must not be exposed as a separate prop.
 */
export const SIDE_TO_SWIPE_DIRECTION = {
  top: "up",
  right: "right",
  bottom: "down",
  left: "left",
} as const;

type SheetSide = keyof typeof SIDE_TO_SWIPE_DIRECTION;

const SheetSideContext = createContext<SheetSide>("right");

/**
 * One stacking level for Overlay and Viewport (sheet.md §8.6). Popup sits inside
 * Viewport, so it does not stamp a third overlay layer. The literal lives in overlay-classes.
 */
const sheetLayer = overlayLayer;

const sheetContentVariants = tv({
  base: "text-sm shadow-lg ease-out pointer-events-auto fixed bg-popover bg-clip-padding text-popover-foreground transition-transform duration-200 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*150ms)] data-ending-style:ease-[cubic-bezier(0.23,1,0.32,1)] data-swiping:transition-none data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:[transform:translateY(var(--drawer-swipe-movement-y,0px))] data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:[transform:translateY(100%)] data-[side=bottom]:data-starting-style:[transform:translateY(100%)] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-full data-[side=left]:[transform:translateX(var(--drawer-swipe-movement-x,0px))] data-[side=left]:border-r data-[side=left]:data-ending-style:[transform:translateX(-100%)] data-[side=left]:data-starting-style:[transform:translateX(-100%)] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-full data-[side=right]:[transform:translateX(var(--drawer-swipe-movement-x,0px))] data-[side=right]:border-l data-[side=right]:data-ending-style:[transform:translateX(100%)] data-[side=right]:data-starting-style:[transform:translateX(100%)] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:[transform:translateY(var(--drawer-swipe-movement-y,0px))] data-[side=top]:border-b data-[side=top]:data-ending-style:[transform:translateY(-100%)] data-[side=top]:data-starting-style:[transform:translateY(-100%)]",
  variants: {
    size: {
      sm: "data-[side=left]:sm:max-w-[min(var(--container-sm),90%)] data-[side=right]:sm:max-w-[min(var(--container-sm),90%)]",
      md: "data-[side=left]:sm:max-w-[min(var(--container-md),90%)] data-[side=right]:sm:max-w-[min(var(--container-md),90%)]",
      lg: "data-[side=left]:sm:max-w-[min(var(--container-lg),90%)] data-[side=right]:sm:max-w-[min(var(--container-lg),90%)]",
      xl: "data-[side=left]:sm:max-w-[min(var(--container-xl),90%)] data-[side=right]:sm:max-w-[min(var(--container-xl),90%)]",
      "2xl":
        "data-[side=left]:sm:max-w-[min(var(--container-2xl),90%)] data-[side=right]:sm:max-w-[min(var(--container-2xl),90%)]",
      "3xl":
        "data-[side=left]:sm:max-w-[min(var(--container-3xl),90%)] data-[side=right]:sm:max-w-[min(var(--container-3xl),90%)]",
      "4xl":
        "data-[side=left]:sm:max-w-[min(var(--container-4xl),90%)] data-[side=right]:sm:max-w-[min(var(--container-4xl),90%)]",
      "5xl":
        "data-[side=left]:sm:max-w-[min(var(--container-5xl),90%)] data-[side=right]:sm:max-w-[min(var(--container-5xl),90%)]",
      "6xl":
        "data-[side=left]:sm:max-w-[min(var(--container-6xl),90%)] data-[side=right]:sm:max-w-[min(var(--container-6xl),90%)]",
      "7xl":
        "data-[side=left]:sm:max-w-[min(var(--container-7xl),90%)] data-[side=right]:sm:max-w-[min(var(--container-7xl),90%)]",
      "8xl": "data-[side=left]:sm:max-w-[min(1366px,90%)] data-[side=right]:sm:max-w-[min(1366px,90%)]",
      "9xl": "data-[side=left]:sm:max-w-[min(1536px,90%)] data-[side=right]:sm:max-w-[min(1536px,90%)]",
      "10xl": "data-[side=left]:sm:max-w-[min(1920px,90%)] data-[side=right]:sm:max-w-[min(1920px,90%)]",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export type SheetRootProps = Omit<
  ComponentProps<typeof SheetPrimitive.Root>,
  "swipeDirection" | "children"
> & {
  /**
   * Edge the panel anchors to. Also selects the swipe-to-dismiss direction
   * (`top` → up, `right` → right, `bottom` → down, `left` → left).
   * @default "right"
   */
  side?: SheetSide;
  /**
   * Contents of the sheet. Rendered inside `VirtualKeyboardProvider` so the panel
   * stays usable when the on-screen keyboard opens.
   */
  children?: ReactNode;
};

function SheetRoot({ side = "right", children, ...props }: SheetRootProps): ReactElement {
  return (
    <SheetSideContext value={side}>
      <SheetPrimitive.Root data-slot="sheet" swipeDirection={SIDE_TO_SWIPE_DIRECTION[side]} {...props}>
        <SheetPrimitive.VirtualKeyboardProvider>{children}</SheetPrimitive.VirtualKeyboardProvider>
      </SheetPrimitive.Root>
    </SheetSideContext>
  );
}

function SheetTrigger({ className, ...props }: ComponentProps<typeof SheetPrimitive.Trigger>): ReactElement {
  return (
    <SheetPrimitive.Trigger data-slot="sheet-trigger" className={cn(selfFocusRing, className)} {...props} />
  );
}

function SheetClose({ className, ...props }: ComponentProps<typeof SheetPrimitive.Close>): ReactElement {
  return <SheetPrimitive.Close data-slot="sheet-close" className={cn(selfFocusRing, className)} {...props} />;
}

function SheetPortal(props: ComponentProps<typeof SheetPrimitive.Portal>): ReactElement {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: ComponentProps<typeof SheetPrimitive.Backdrop>): ReactElement {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        overlayScrimClass,
        "fixed inset-0 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:transition-none",
        sheetLayer,
        className
      )}
      {...props}
    />
  );
}

export type SheetContentProps = ComponentProps<typeof SheetPrimitive.Popup> &
  VariantProps<typeof sheetContentVariants> & {
    /**
     * Renders the built-in corner dismiss affordance — the shared overlay close
     * helper (`Button variant="ghost" size="icon-sm"`) as a `Sheet.Close`.
     */
    showCloseButton?: boolean;
    /**
     * Portal target for the panel. Defaults to the nearest enclosing `ThemeScope`
     * element, so an overlay never escapes the theme that opened it.
     */
    container?: HTMLElement | RefObject<HTMLElement | null>;
    /**
     * Accessible name for the built-in corner close button. Defaults to the locale
     * dictionary.
     */
    closeLabel?: string;
  };

function SheetContent({
  className,
  children,
  size,
  showCloseButton = true,
  container,
  closeLabel,
  ...props
}: SheetContentProps): ReactElement | null {
  const side = use(SheetSideContext);
  const strings = useLocalizedStrings(sheetStrings);
  const resolvedContainer = useThemeScopeContainer(container);

  // theming.md §7.4: an explicit ref or an enclosing ThemeScope whose element is not
  // attached yet means wait — never a brief escape to the document body. Only an absent
  // scope (`undefined`) leaves the primitive default in place.
  if (resolvedContainer === null) {
    return null;
  }

  const label = closeLabel ?? strings.format("close");

  return (
    <SheetPortal container={resolvedContainer}>
      <SheetOverlay />
      <SheetPrimitive.Viewport
        data-slot="sheet-viewport"
        className={cn("pointer-events-none fixed inset-0", sheetLayer)}>
        <SheetPrimitive.Popup
          data-slot="sheet-content"
          data-side={side}
          className={cn(sheetContentVariants({ size }), className)}
          {...props}>
          <SheetPrimitive.Content
            data-slot="sheet-content-inner"
            className="flex h-full w-full flex-col gap-4">
            {children}
            {showCloseButton ? (
              <SheetPrimitive.Close data-slot="sheet-close" render={overlayCornerCloseButton({ label })} />
            ) : null}
          </SheetPrimitive.Content>
        </SheetPrimitive.Popup>
      </SheetPrimitive.Viewport>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 px-4 pt-4", className)} {...props} />
  );
}

function SheetBody({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 space-y-6 overflow-y-auto px-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
  );
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>): ReactElement {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-xl font-medium font-heading text-balance text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>): ReactElement {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-base text-pretty text-muted-foreground", className)}
      {...props}
    />
  );
}

SheetRoot.displayName = "Sheet.Root";
SheetTrigger.displayName = "Sheet.Trigger";
SheetClose.displayName = "Sheet.Close";
SheetPortal.displayName = "Sheet.Portal";
SheetOverlay.displayName = "Sheet.Overlay";
SheetContent.displayName = "Sheet.Content";
SheetHeader.displayName = "Sheet.Header";
SheetBody.displayName = "Sheet.Body";
SheetFooter.displayName = "Sheet.Footer";
SheetTitle.displayName = "Sheet.Title";
SheetDescription.displayName = "Sheet.Description";

export const Sheet = {
  Root: SheetRoot,
  Trigger: SheetTrigger,
  Close: SheetClose,
  Portal: SheetPortal,
  Overlay: SheetOverlay,
  Content: SheetContent,
  Header: SheetHeader,
  Body: SheetBody,
  Footer: SheetFooter,
  Title: SheetTitle,
  Description: SheetDescription,
};
