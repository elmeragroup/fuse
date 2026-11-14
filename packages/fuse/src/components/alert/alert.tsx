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
       * Runs when the action button is clicked. The alert renders the button only when this and
       * `actionLabel` are both set. `Alert.Root` is a server component, so pass the handler from a
       * client component.
       */
      onAction: AlertActionHandler;
      /**
       * The action button's label and accessible name. Set it together with `onAction`, and write
       * a label that makes sense without the alert text, such as "Retry sync".
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
  AlertActionProps & {
    /** The status. It sets the alert's colours and its icon. */
    variant?: VariantProps<typeof alertVariants>["variant"];
    /**
     * The live-region role. A screen reader announces an `alert` at once, interrupting the user,
     * when it is inserted or its content changes. Keep `alert` for errors and warnings that need
     * attention now. Pass `status` for an informational message, which the screen reader
     * announces after it finishes speaking. It announces a status region only when its content
     * changes while the region is in the DOM, so keep `Alert.Root` mounted and swap its children.
     * Pass `none` for a static notice that is not announced.
     */
    role?: AriaRole;
    /**
     * The alert's text, an `Alert.Title` and an optional `Alert.Description`. Render both as
     * direct children of `Alert.Root`, where the density catalog finds them.
     */
    children?: ReactNode;
  };

export type AlertIconProps = Omit<ComponentProps<typeof Info>, "title" | "weight"> & {
  /**
   * The status whose glyph it draws. `default` and `info` draw Info, `warning` draws Warning,
   * `destructive` draws WarningOctagon and `success` draws CheckCircle.
   */
  variant: AlertVariant;
  /**
   * The Phosphor stroke weight. `regular` draws a thinner stroke. Keep `fill` for selected or
   * active states.
   */
  weight?: ComponentProps<typeof Info>["weight"];
};

export type AlertTitleProps = ComponentProps<"h3"> & {
  /**
   * The heading level. `1` to `6` renders `h1` to `h6`. Set the level that fits the alert into
   * the page's heading outline.
   */
  level?: AlertTitleLevel;
};

export type AlertDescriptionProps = ComponentProps<"div">;

/**
 * A status message built on Item. It is a server component with no state, effects or browser
 * APIs. It passes `onAction` to its button as the click handler.
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
  const { base, media, button } = alertVariants({ variant });

  return (
    <ItemRootElement
      {...props}
      role={role}
      // Marks the alert's own Item parts, which PART_DENSITY gives the label role.
      data-alert=""
      variant="outline"
      size="sm"
      className={cn(base(), className)}>
      <ItemMedia variant="icon" className={media()}>
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

/** The status glyph `Alert.Root` draws, for use outside an alert. It is always decorative. */
function AlertIcon({ variant, weight = "bold", className, ...props }: AlertIconProps): ReactElement {
  const { icon } = alertVariants({ variant });
  const Glyph = ALERT_ICONS[variant];

  return (
    <Glyph
      data-slot="alert-icon"
      weight={weight}
      className={cn(icon(), className)}
      {...props}
      aria-hidden="true"
    />
  );
}

/**
 * The alert's heading, an `h3` unless `level` sets another level. Its text follows document
 * density, 14px dense and 16px comfortable, at `font-medium`, a heavier weight than the body.
 */
function AlertTitle({ children, className, level = 3, ...props }: AlertTitleProps): ReactElement {
  const TitleTag = `h${level}` as const;
  const { title } = alertVariants();

  return (
    <TitleTag data-slot="item-title" className={cn(ITEM_TITLE_CLASSES, title(), className)} {...props}>
      {children}
    </TitleTag>
  );
}

/**
 * The alert body, a `div` without Item.Description's two-line clamp, so it can hold
 * paragraphs and lists. Its text follows document density, 14px dense and 16px comfortable, at
 * regular weight. It takes the variant's text colour from `Alert.Root`, as the title does.
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
