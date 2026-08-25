import type { ComponentProps, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { CheckCircle } from "../../icons/generated/check-circle";
import { Info } from "../../icons/generated/info";
import { Warning } from "../../icons/generated/warning";
import { WarningOctagon } from "../../icons/generated/warning-octagon";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import { Item } from "../item/item";
import { alertVariants } from "./alert-variants";

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;
type AlertTitleLevel = 1 | 2 | 3 | 4 | 5 | 6;

const ALERT_ICONS = {
  default: Info,
  warning: Warning,
  destructive: WarningOctagon,
  success: CheckCircle,
} as const;

/** Item.Title classes, kept on our own heading so the outline stays an `h*` (alert.md §8.2). */
const ITEM_TITLE_CLASSES =
  "text-sm leading-snug font-medium line-clamp-1 flex w-fit items-center gap-2 underline-offset-4";

export type AlertRootProps = ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    /**
     * When set, renders a `Button` in `Item.Actions`. Forwarded as the button's
     * `onClick` — the client boundary is the consumer's (alert.md §1/§3).
     */
    onAction?: ComponentProps<typeof Button>["onClick"];
    /**
     * Action button children. Rendered only when `onAction` is set (alert.md §3).
     */
    actionLabel?: ReactNode;
  };

export type AlertIconProps = Omit<ComponentProps<typeof Info>, "weight"> & {
  /**
   * Status glyph. `default → Info`, `warning → Warning`, `destructive → WarningOctagon`,
   * `success → CheckCircle` (alert.md §3).
   */
  variant: AlertVariant;
  /**
   * Phosphor weight. Regular is the library default; `fill` is reserved for selected
   * or active states (conventions.md § Icons).
   */
  weight?: "regular" | "fill";
};

export type AlertTitleProps = ComponentProps<"h3"> & {
  /**
   * Heading element level — `1`–`6` picks the rendered `h1`–`h6`. Defaults to `3` so an
   * alert titles itself without assuming its place in the document outline.
   */
  level?: AlertTitleLevel;
};

export type AlertDescriptionProps = ComponentProps<"p">;

/**
 * Status alert composite over the library Item family (alert.md §2/§7). Server —
 * it owns no state, effects, or browser APIs; `onAction` is a forwarded consumer
 * handler (performance.md §RSC classification).
 */
function AlertRoot({
  children,
  className,
  variant = "default",
  onAction,
  actionLabel,
  ...props
}: AlertRootProps): ReactElement {
  const { base, content, button } = alertVariants({ variant });

  return (
    <Item.Root {...props} role="alert" variant="outline" size="sm" className={cn(base(), className)}>
      <Item.Media>
        <AlertIcon variant={variant} />
      </Item.Media>
      <Item.Content className={content()}>{children}</Item.Content>
      {onAction ? (
        <Item.Actions>
          <Button className={button()} size="sm" type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        </Item.Actions>
      ) : null}
    </Item.Root>
  );
}

function AlertIcon({ variant, className, ...props }: AlertIconProps): ReactElement {
  const { icon } = alertVariants({ variant });
  const Glyph = ALERT_ICONS[variant];

  return <Glyph data-slot="alert-icon" className={cn(icon(), className)} {...props} aria-hidden="true" />;
}

function AlertTitle({ children, className, level = 3, ...props }: AlertTitleProps): ReactElement {
  const { title } = alertVariants();
  const TitleTag = `h${level}` as const;

  return (
    <TitleTag data-slot="item-title" className={cn(ITEM_TITLE_CLASSES, title(), className)} {...props}>
      {children}
    </TitleTag>
  );
}

function AlertDescription({ className, ...props }: AlertDescriptionProps): ReactElement {
  const { description } = alertVariants();

  return <Item.Description className={cn(description(), className)} {...props} />;
}

AlertRoot.displayName = "Alert.Root";
AlertIcon.displayName = "Alert.Icon";
AlertTitle.displayName = "Alert.Title";
AlertDescription.displayName = "Alert.Description";

export const Alert = {
  Root: AlertRoot,
  Icon: AlertIcon,
  Title: AlertTitle,
  Description: AlertDescription,
};
