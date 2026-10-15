import type { AriaRole, ComponentProps, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { CheckCircle } from "../../icons/generated/check-circle";
import { Info } from "../../icons/generated/info";
import { Warning } from "../../icons/generated/warning";
import { WarningOctagon } from "../../icons/generated/warning-octagon";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import { ITEM_DESCRIPTION_CLASSES } from "../item/item-description-classes";
import { ItemActions, ItemContent, ItemMedia, ItemRootElement } from "../item/item-markup";
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
  info: Info,
} as const;

export type AlertRootProps = ComponentProps<"div"> &
  VariantProps<typeof alertVariants> &
  AlertActionProps & {
    /**
     * Live-region role. Defaults to `alert`, announced assertively, interrupting the user, when
     * the alert is inserted or its content changes: keep it for errors and warnings that need
     * attention now. Pass `status` for an informational message announced politely, after the
     * reader finishes. Screen readers announce a status region only when its content changes
     * while it is already in the DOM, so keep `Alert.Root` mounted and swap its children. Pass
     * `none` for a static notice that is not announced.
     */
    role?: AriaRole;
  };

export type AlertIconProps = Omit<ComponentProps<typeof Info>, "title" | "weight"> & {
  /**
   * Status glyph. `default → Info`, `warning → Warning`, `destructive → WarningOctagon`,
   * `success → CheckCircle`, `info → Info`.
   */
  variant: AlertVariant;
  /**
   * Phosphor weight. Bold is the library default; `regular` draws a thinner stroke and
   * `fill` is reserved for selected or active states.
   */
  weight?: ComponentProps<typeof Info>["weight"];
};

export type AlertTitleProps = ComponentProps<"h3"> & {
  /**
   * Heading element level — `1`–`6` picks the rendered `h1`–`h6`. Defaults to `3` so an
   * alert titles itself without assuming its place in the document outline.
   */
  level?: AlertTitleLevel;
};

export type AlertDescriptionProps = ComponentProps<"div">;

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
  role = "alert",
  ...props
}: AlertRootProps): ReactElement {
  const { base, button } = alertVariants({ variant });

  return (
    <ItemRootElement {...props} role={role} variant="outline" size="sm" className={cn(base(), className)}>
      <ItemMedia variant="icon">
        <AlertIcon variant={variant} />
      </ItemMedia>
      <ItemContent>{children}</ItemContent>
      {hasAction(onAction, actionLabel) ? (
        <ItemActions>
          <Button className={button()} size="sm" type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        </ItemActions>
      ) : null}
    </ItemRootElement>
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

/**
 * Renders the alert body as a `div` without Item.Description's two-line clamp, so it can
 * hold full instructions, paragraphs and lists.
 */
function AlertDescription({ className, ...props }: AlertDescriptionProps): ReactElement {
  const { description } = alertVariants();

  // The `item-description` slot centres Item.Media's icon on the title's first line instead of the
  // middle of multi-line content.
  return (
    <div
      data-slot="item-description"
      className={cn(ITEM_DESCRIPTION_CLASSES, description(), className)}
      {...props}
    />
  );
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
