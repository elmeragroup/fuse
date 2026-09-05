"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { CheckCircle } from "../../icons/generated/check-circle";
import { Circle } from "../../icons/generated/circle";
import { cn } from "../../styles/cn";
import {
  iconCrossfadeHidden,
  iconCrossfadeShown,
  iconCrossfadeTransition,
  selfFocusRingClass,
} from "../../styles/utils";
import { Badge } from "../badge/badge";
import { Card } from "../card/card";

const checkboxCardStyles = tv({
  base: "",
  variants: {
    variant: {
      default: "bg-card",
      muted: "bg-muted",
    },
    isDisabled: {
      true: "opacity-75",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type CheckboxCardProps = Omit<
  ComponentProps<typeof CheckboxPrimitive.Root>,
  "render" | "disabled" | "title" | "className"
> &
  VariantProps<typeof checkboxCardStyles> & {
    /** Extra content below the description, inside the label. */
    children?: ReactNode;
    /**
     * Visible title. The native string `title` attribute is omitted so this
     * `ReactNode` is not narrowed to `string`.
     */
    title: ReactNode;
    /** Badge chips above the title. The row is omitted when `tags` is empty or absent. */
    tags?: string[];
    /** Supporting line under the title (`text-sm text-pretty`). */
    description: string;
    /** Trailing slot outside the label — clicks there do not toggle the checkbox. */
    rightContent?: ReactNode;
    /**
     * Applies `opacity-75` on the card and `disabled` on the checkbox primitive.
     * Primitive `disabled` is omitted from the pass-through.
     */
    isDisabled?: boolean;
    /** Checkbox group membership value. */
    value?: string;
  };

/**
 * Selectable marketing/product card over the base-ui Checkbox primitive
 * (checkbox-card.md §2/§7). Client — Field.Item / label wiring and the checkbox
 * primitive (performance.md §RSC classification). Requires a `Field.Root`
 * ancestor and a checkbox-group ancestor for `value` membership.
 */
export function CheckboxCard({
  children,
  title,
  tags,
  description,
  variant = "default",
  rightContent,
  isDisabled,
  value,
  ...other
}: CheckboxCardProps): ReactElement {
  return (
    <FieldPrimitive.Item>
      <Card.Root className={checkboxCardStyles({ variant, isDisabled })}>
        <Card.Content className="flex items-center justify-between gap-3 px-4 py-3">
          {/* oxlint-disable-next-line elmera/no-local-focus-ring -- checkbox-card.md §7: label is not the focus target; the checkbox owns the adapter */}
          <FieldPrimitive.Label className="group flex grow cursor-pointer items-center gap-3 bg-clip-padding outline-hidden has-disabled:cursor-not-allowed">
            <CheckboxPrimitive.Root
              value={value}
              disabled={isDisabled}
              className={cn(
                // oxlint-disable-next-line elmera/no-local-focus-ring -- checkbox-card.md §7: native outline off; ring comes from the shared adapter
                "flex shrink-0 items-center rounded-full text-foreground outline-hidden select-none",
                selfFocusRingClass
              )}
              render={(props, state) => (
                <span {...props} className={cn(props.className, "relative inline-grid size-6")}>
                  <Circle
                    aria-hidden
                    className={cn(
                      "col-start-1 row-start-1 size-6 text-foreground",
                      iconCrossfadeTransition,
                      state.checked ? iconCrossfadeHidden : iconCrossfadeShown
                    )}
                  />
                  <CheckCircle
                    aria-hidden
                    weight="fill"
                    className={cn(
                      "col-start-1 row-start-1 size-6 text-success",
                      iconCrossfadeTransition,
                      state.checked ? iconCrossfadeShown : iconCrossfadeHidden
                    )}
                  />
                </span>
              )}
              {...other}
            />
            <div>
              <div className="flex flex-1 flex-col">
                {tags && tags.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                ) : null}
                <div className="text-lg font-medium text-balance text-foreground">{title}</div>
              </div>
              <div className="text-sm text-pretty text-foreground">{description}</div>
              {children}
            </div>
          </FieldPrimitive.Label>
          {rightContent ? <>{rightContent}</> : null}
        </Card.Content>
      </Card.Root>
    </FieldPrimitive.Item>
  );
}

CheckboxCard.displayName = "CheckboxCard";
