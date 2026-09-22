import type { ComponentProps, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { CheckCircle } from "../../icons/generated/check-circle";
import { Info } from "../../icons/generated/info";
import { Warning } from "../../icons/generated/warning";
import { WarningOctagon } from "../../icons/generated/warning-octagon";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import { Item } from "../item/item";
import { ITEM_TITLE_CLASSES } from "../item/item-title-classes";
import { alertVariants } from "./alert-variants";

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;
type AlertTitleLevel = 1 | 2 | 3 | 4 | 5 | 6;
type AlertActionHandler = ComponentProps<typeof Button>["onClick"];

type AlertActionProps =
  | {
      /**
       * When both `onAction` and `actionLabel` are set, renders a `Button` in
       * `Item.Actions`. Forwarded as the button's `onClick` — the client
       * boundary is the consumer's.
       */
      onAction: AlertActionHandler;
      /**
       * Accessible name and visible children of the action button. Required
       * together with `onAction`; must be self-describing.
       */
      actionLabel: ReactNode;
    }
  | {
      onAction?: never;
      actionLabel?: never;
    };

const ALERT_ICONS = {
  default: Info,
  warning: Warning,
  destructive: WarningOctagon,
  success: CheckCircle,
} as const;

export type AlertRootProps = ComponentProps<"div"> & VariantProps<typeof alertVariants> & AlertActionProps;

export type AlertIconProps = Omit<ComponentProps<typeof Info>, "weight"> & {
  /**
   * Status glyph. `default → Info`, `warning → Warning`, `destructive → WarningOctagon`,
   * `success → CheckCircle`.
   */
  variant: AlertVariant;
  /**
   * Phosphor weight. Regular is the library default; `fill` is reserved for selected
   * or active states.
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
 * Status alert composite over the library Item family. Server —
 * it owns no state, effects, or browser APIs; `onAction` is a forwarded consumer
 * handler.
 */
function AlertRoot({
  children,
  className,
  variant = "default",
  onAction,
  actionLabel,
  ...props
}: AlertRootProps): ReactElement {
  const { base, button } = alertVariants({ variant });

  return (
    <Item.Root {...props} role="alert" variant="outline" size="sm" className={cn(base(), className)}>
      <Item.Media>
        <AlertIcon variant={variant} />
      </Item.Media>
      <Item.Content>{children}</Item.Content>
      {hasAction(onAction, actionLabel) ? (
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
  const TitleTag = `h${level}` as const;

  return (
    <TitleTag data-slot="item-title" className={cn(ITEM_TITLE_CLASSES, className)} {...props}>
      {children}
    </TitleTag>
  );
}

function AlertDescription({ className, ...props }: AlertDescriptionProps): ReactElement {
  const { description } = alertVariants();

  return <Item.Description className={cn(description(), className)} {...props} />;
}

function hasAction(
  onAction: AlertActionHandler | undefined,
  actionLabel: ReactNode
): onAction is AlertActionHandler {
  return onAction != null && actionLabel != null && actionLabel !== false && actionLabel !== "";
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
