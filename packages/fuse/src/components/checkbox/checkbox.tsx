"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";

import { useCheckedResetSync } from "../../hooks/use-checked-reset-sync";
import { Check } from "../../icons/generated/check";
import { Minus } from "../../icons/generated/minus";
import { definedProps } from "../../internal/defined-props";
import { isTextNode } from "../../internal/is-text-node";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { FieldFrame } from "../field/field-frame";
import { SelectionGroupLayout, SelectionItemGroup } from "../selection-item/selection-item";
import { selectionGroupOrientationVariants } from "../selection-item/selection-item-variants";
import { checkboxVariants } from "./checkbox-variants";

const slots = checkboxVariants();

/**
 * Unlabeled 16px checkbox over the base-ui primitive. Client component, because base-ui
 * Checkbox owns the checked state. The indicator is internal: Phosphor regular `Minus`
 * when indeterminate, `Check` otherwise. Labeled usage composes `Field.Root` and
 * `Field.Label`, or `CheckboxItem`. A disabled checkbox dims to 50% on its own, also
 * outside a field. The box rounds with `rounded-md` capped at 4px in every theme. Native form
 * reset, including React's reset after a form action, keeps the current state and what the form
 * submits in step; an uncontrolled checkbox does not return to `defaultChecked`.
 */
export function Checkbox({
  className,
  inputRef,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>): ReactElement {
  const syncedInputRef = useCheckedResetSync(inputRef);
  return (
    <CheckboxPrimitive.Root
      inputRef={syncedInputRef}
      data-slot="checkbox"
      className={mergeClassName(className, slots.root())}
      {...definedProps(props)}>
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={slots.indicator()}
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>{state.indeterminate ? <Minus /> : <Check />}</span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export type CheckboxGroupProps = {
  /** Fieldset legend, rendered as `Field.Legend variant="label"`. The legend row is omitted when absent. */
  label?: string;
  /**
   * Hides the legend visually and keeps it as the group's accessible name, for a group
   * under a heading that already names it. The first option moves up into the legend's
   * place. Default `false`.
   */
  isLabelHidden?: boolean;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. Falsy, the
   * field shows its own validation error instead, such as a native constraint message.
   */
  errorMessage?: ReactNode;
  /**
   * Layout of the group primitive, and of CheckboxItemGroup's stacked-card list.
   * Vertical: primitive `flex-col` gapped by `--surface-gap-sm`; item list connected
   * `flex-col gap-0`. Horizontal: primitive `flex-wrap` and item list `flex-row flex-wrap`, gapped
   * by `--surface-gap-lg`
   * with individually rounded cards. Maps through `selectionGroupOrientationVariants`.
   */
  orientation?: "vertical" | "horizontal";
  /** Controlled selected values. */
  value?: string[];
  /** Uncontrolled initial selected values. */
  defaultValue?: string[];
  /** Called with the selected `string[]`, not the event. Mapped to base-ui `onValueChange`. */
  onChange?: (value: string[]) => void;
  /**
   * Enables the tri-state `parent` checkbox. Base-ui derives checked/indeterminate
   * from whether the group's value is a subset of these members.
   */
  allValues?: string[];
  /** Forwards `disabled` to `Field.Root` and the group primitive. */
  isDisabled?: boolean;
  /** Forwards `invalid` to `Field.Root`. */
  isInvalid?: boolean;
  /**
   * Set on `Field.Root`, not the group primitive. Base-ui's CheckboxGroup has no
   * `name`; Field context threads it to member hidden inputs. RadioGroup puts
   * `name` on its primitive — the face is the same `name?: string` either way.
   */
  name?: string;
  /** Forwarded to the group primitive. */
  id?: string;
  /** Extra classes, merged onto the group primitive via `cn`. */
  className?: string;
  /** Group members — typically `Checkbox` or `CheckboxItem`. */
  children?: ReactNode;
};

/**
 * Labeled checkbox group composite over Field and base-ui CheckboxGroup. Client component,
 * because it wires Field validity and the group primitive. Native form reset, including
 * React's reset after a form action, keeps the selection and what the form submits in step for
 * Fuse members; an uncontrolled group does not return to `defaultValue`.
 */
export function CheckboxGroup({
  label,
  isLabelHidden = false,
  description,
  errorMessage,
  orientation = "vertical",
  value,
  defaultValue,
  onChange,
  allValues,
  isDisabled,
  isInvalid,
  name,
  id,
  className,
  children,
}: CheckboxGroupProps): ReactElement {
  return (
    <FieldFrame
      heading="legend"
      label={label}
      isLabelHidden={isLabelHidden}
      description={description}
      errorMessage={errorMessage}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}>
      <CheckboxGroupPrimitive
        data-slot="checkbox-group"
        // The layout axis, as Card writes it: a vertical stack of selection shells is connected.
        data-direction={orientation}
        id={id}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onChange}
        allValues={allValues}
        disabled={isDisabled}
        className={cn(selectionGroupOrientationVariants({ orientation }).group(), className)}>
        <SelectionGroupLayout orientation={orientation}>{children}</SelectionGroupLayout>
      </CheckboxGroupPrimitive>
    </FieldFrame>
  );
}

/**
 * Stacked-card group: `CheckboxGroup` wrapping children in the private
 * SelectionItem list (`role="list"`). `orientation` is forwarded to the labeled
 * outer group and to that list: vertical remains connected `flex-col gap-0`;
 * horizontal is `flex-row flex-wrap`, gapped by `--surface-gap-lg`, with individually rounded cards.
 */
export function CheckboxItemGroup({ orientation = "vertical", ...props }: CheckboxGroupProps): ReactElement {
  // The default is spelled here because the docs API extractor reads a part's
  // documented defaults out of its own destructuring.
  return (
    <CheckboxGroup {...props} orientation={orientation}>
      <SelectionItemGroup orientation={orientation}>{props.children}</SelectionItemGroup>
    </CheckboxGroup>
  );
}

export type CheckboxDescriptionProps = {
  /** Typically a `Checkbox`. */
  children?: ReactNode;
  /**
   * Trailing note. A string renders as a muted `<small>`; any other node renders
   * intact. Visual-only — not wired to `aria-describedby`. Use Field description
   * wiring when programmatic association is required.
   */
  describedBy?: ReactNode;
};

/**
 * Inline "checkbox + trailing note" row. The note is
 * visual-only; it does not become an accessible description.
 */
export function CheckboxDescription({ children, describedBy }: CheckboxDescriptionProps): ReactElement {
  // Only a string `describedBy` becomes the muted `<small>` note.
  return (
    <div className="flex items-start gap-2">
      {children}
      {isTextNode(describedBy) ? (
        <small className="text-sm text-muted-foreground">{describedBy}</small>
      ) : (
        describedBy
      )}
    </div>
  );
}

Checkbox.displayName = "Checkbox";
CheckboxGroup.displayName = "CheckboxGroup";
CheckboxItemGroup.displayName = "CheckboxItemGroup";
CheckboxDescription.displayName = "CheckboxDescription";
