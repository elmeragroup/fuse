"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { VariantProps } from "tailwind-variants";

import { useCheckedResetSync } from "../../hooks/use-checked-reset-sync";
import { CheckCircle } from "../../icons/generated/check-circle";
import { Circle } from "../../icons/generated/circle";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { checkboxCardContentShellClass } from "../../styles/inner-corner/card";
import { propDisabledStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import {
  iconCrossfadeHidden,
  iconCrossfadeShown,
  iconCrossfadeTransition,
  selfFocusRingClass,
} from "../../styles/utils";
import { Badge } from "../badge/badge";
import { Card } from "../card/card";

const checkboxCardStyles = tv({
  // The card is a control, so it keeps the `--border` edge and the plain `shadow-xs` where Card's
  // `--card-border` and `--card-shadow` go transparent in branded themes.
  base: "shadow-xs border-border",
  variants: {
    variant: {
      // Card.Root paints the card fill and states it as `--surface`.
      default: "",
      // The muted card swaps Card's fill, so it restates the text, `--surface` and muted text
      // Card states beside its own.
      muted:
        "bg-muted text-foreground [--surface-muted-foreground:--theme(--color-muted-foreground)] [--surface:--theme(--color-muted)]",
    },
    // The card is the whole control, so it takes the one disabled look on its `isDisabled`
    // arm: the prop, not a selector, carries the state to the card.
    isDisabled: {
      true: propDisabledStateFaceClass,
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
    /**
     * The card's fill. `default` is the card fill, and `muted` the muted fill. Both keep the
     * `--border` edge in every theme, since the card is a control.
     */
    variant?: VariantProps<typeof checkboxCardStyles>["variant"];
    /** Extra content below the description, inside the label. */
    children?: ReactNode;
    /** The card's visible title. It takes any node, where the native `title` attribute takes a string. */
    title: ReactNode;
    /** Badges above the title. An empty or missing list draws no badge row. */
    tags?: string[];
    /** The line of supporting text under the title. */
    description: string;
    /**
     * Content at the card's end, outside the label, such as a link or a button. A click there
     * does not toggle the checkbox.
     */
    rightContent?: ReactNode;
    /** Disables the checkbox and dims the whole card to 50% with the `not-allowed` cursor. */
    isDisabled?: boolean;
    /**
     * The value the card adds to the enclosing `CheckboxGroup`'s selection. Inside a group, the
     * group's `value` or `defaultValue` decides whether the card is checked, and the card's own
     * `checked` and `defaultChecked` have no effect.
     */
    value?: string;
  };

/**
 * A selectable card for a product or plan, built on Base UI's checkbox. It needs a `Field.Root`
 * ancestor, and a `CheckboxGroup` ancestor for `value` to join a selection. A native form reset,
 * including React's reset after a form action, keeps the shown state and the submitted value in
 * step. An uncontrolled card does not return to `defaultChecked`.
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
  inputRef,
  ...other
}: CheckboxCardProps): ReactElement {
  const syncedInputRef = useCheckedResetSync(inputRef);
  return (
    <FieldPrimitive.Item>
      <Card.Root className={checkboxCardStyles({ variant, isDisabled })}>
        <Card.Content
          className={cn(checkboxCardContentShellClass, "flex items-center justify-between gap-3")}>
          {/* oxlint-disable-next-line elmera/no-local-focus-ring -- label is not the focus target; the checkbox owns the adapter */}
          <FieldPrimitive.Label className="group flex grow cursor-pointer items-center gap-3 bg-clip-padding outline-hidden has-disabled:cursor-not-allowed">
            <CheckboxPrimitive.Root
              inputRef={syncedInputRef}
              value={value}
              disabled={isDisabled}
              className={cn(
                // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
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
              {...definedProps(other)}
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
