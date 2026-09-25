"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";

import { Check } from "../../icons/generated/check";
import { Minus } from "../../icons/generated/minus";
import { isTextNode } from "../../internal/is-text-node";
import { cn } from "../../styles/cn";
import { checkboxCornerClass } from "../../styles/corner-radius";
import { mergeClassName } from "../../styles/merge-class-name";
import { dataStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { FieldFrame } from "../field/field-frame";
import { SelectionItem } from "../selection-item";
import {
  SelectionGroupLayout,
  SelectionItemGroup,
  SelectionItemShell,
} from "../selection-item/selection-item";
import { selectionGroupOrientationVariants } from "../selection-item/selection-item-variants";

/**
 * Unlabeled 16px checkbox over the base-ui primitive. Client component, because base-ui
 * Checkbox owns the checked state. The indicator is internal: Phosphor regular `Minus`
 * when indeterminate, `Check` otherwise. Labeled usage composes `Field.Root` and
 * `Field.Label`, or `CheckboxItem`. A disabled checkbox dims to 50% on its own, also
 * outside a field. Internal themes round the box with the one radius, and external themes
 * keep the reference's 4px corner.
 */
export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>): ReactElement {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={mergeClassName(
        className,
        // The root is a <span>, which never matches `:disabled`, so the state face keys off
        // Base UI's `data-disabled` and `data-invalid` attributes, plus a consumer's
        // `aria-invalid`. A checked invalid box keeps its primary border beside the ring.
        // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
        "peer shadow-xs ease-out relative flex size-4 max-w-4 shrink-0 items-center justify-center border border-input bg-card transition-[color,background-color,border-color,box-shadow] duration-150 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 after:content-[''] data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        checkboxCornerClass,
        selfFocusRingClass,
        dataStateFaceClass,
        "aria-invalid:aria-checked:border-primary data-invalid:aria-checked:border-primary"
      )}
      {...props}>
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
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
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /** Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. */
  errorMessage?: ReactNode;
  /**
   * Layout of the group primitive, and of CheckboxItemGroup's stacked-card list.
   * Vertical: primitive `flex-col gap-2`; item list connected `flex-col gap-0`.
   * Horizontal: primitive `flex-wrap gap-4`; item list `flex-row flex-wrap gap-4`
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
 * because it wires Field validity and the group primitive.
 */
export function CheckboxGroup({
  label,
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
      description={description}
      errorMessage={errorMessage}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}>
      <CheckboxGroupPrimitive
        data-slot="checkbox-group"
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
 * horizontal is `flex-row flex-wrap gap-4` with individually rounded cards.
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

type CheckboxItemBaseProps = {
  /** Forwards `disabled` to the inner Checkbox and applies disabled hatch styling on the shell. */
  isDisabled?: boolean;
  /** Forwards `readOnly` to the inner Checkbox. */
  isReadOnly?: boolean;
  /**
   * Where the control sits in the labelled row. Forwarded to `SelectionItem.Shell`.
   * Default `"start"`.
   */
  controlPosition?: "start" | "end";
  /** Extra classes, merged onto the shell via `cn`. */
  className?: string;
  /**
   * Row children, partitioned by the shell. Direct `CheckboxItem.SubSection` (the
   * same object as `SelectionItem.SubSection`) children render outside the label.
   */
  children?: ReactNode;
};

/**
 * Discriminated parent-vs-value union. Parent rows derive tri-state from the
 * group's `allValues` and must not set `value`.
 */
export type CheckboxItemProps = CheckboxItemBaseProps &
  (
    | {
        /** Member value in the group. Required unless `parent`. */
        value: string;
        /** When true, this row is the tri-state parent. Incompatible with `value`. */
        parent?: false;
      }
    | {
        /** Tri-state parent — checked/indeterminate/unchecked from the group's `allValues`. */
        parent: true;
        /** Parent rows must not set `value`. */
        value?: never;
      }
  );

/**
 * Labeled selection row over `SelectionItem.Shell`. Client component, because it wires
 * Field.Item and the label. The namespace aliases `Title`, `Description`, `Content`,
 * `Actions` and `SubSection` are the exact `SelectionItem.*` objects, so `child.type`
 * partitioning works with either spelling.
 */
export function CheckboxItem({
  value,
  parent,
  isDisabled,
  isReadOnly,
  controlPosition = "start",
  className,
  children,
}: CheckboxItemProps): ReactElement {
  return (
    <SelectionItemShell
      dataSlot="checkbox-item"
      isDisabled={isDisabled}
      controlPosition={controlPosition}
      className={className}
      control={
        parent === true ? (
          <Checkbox parent disabled={isDisabled} readOnly={isReadOnly} />
        ) : (
          <Checkbox value={value} disabled={isDisabled} readOnly={isReadOnly} />
        )
      }>
      {children}
    </SelectionItemShell>
  );
}

Checkbox.displayName = "Checkbox";
CheckboxGroup.displayName = "CheckboxGroup";
CheckboxItemGroup.displayName = "CheckboxItemGroup";
CheckboxDescription.displayName = "CheckboxDescription";
CheckboxItem.displayName = "CheckboxItem";

CheckboxItem.Title = SelectionItem.Title;
CheckboxItem.Description = SelectionItem.Description;
CheckboxItem.Content = SelectionItem.Content;
CheckboxItem.Actions = SelectionItem.Actions;
CheckboxItem.SubSection = SelectionItem.SubSection;
