"use client";

import { createContext, useContext } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";

import { Check } from "../../icons/generated/check";
import { Minus } from "../../icons/generated/minus";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { Field } from "../field/field";
import { Item } from "../item/item";
import { SelectionItem } from "../selection-item/selection-item";

const selfFocusRing = focusRing({ target: "self" }).root();
const CheckboxItemGroupContext = createContext(false);

/**
 * Unlabeled 16px checkbox over the base-ui primitive (checkbox.md §2/§7). Client —
 * base-ui Checkbox owns checked state (performance.md §RSC classification). The
 * indicator is internal: Phosphor regular `Minus` when indeterminate, `Check`
 * otherwise. Labeled usage composes `Field.Root` + `Field.Label`, or `CheckboxItem`.
 */
export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>): ReactElement {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer shadow-xs ease-out relative flex size-4 max-w-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-card transition-[color,background-color,border-color,box-shadow] duration-150 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 aria-invalid:aria-checked:border-primary data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        selfFocusRing,
        className
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
   * Layout of the group primitive. Vertical is `flex-col gap-2`; horizontal is
   * `flex-wrap gap-4`. Not a recipe axis.
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
 * Labeled checkbox group composite over Field + base-ui CheckboxGroup
 * (checkbox.md §2/§7). Client — Field validity wiring and the group primitive
 * (performance.md §RSC classification).
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
    <Field.Root name={name} invalid={isInvalid} disabled={isDisabled}>
      <Field.Set>
        {label ? <Field.Legend variant="label">{label}</Field.Legend> : null}
        {description ? <Field.Description>{description}</Field.Description> : null}
        <CheckboxGroupPrimitive
          data-slot="checkbox-group"
          id={id}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onChange}
          allValues={allValues}
          disabled={isDisabled}
          className={cn(
            orientation === "horizontal" ? "flex flex-wrap gap-4" : "flex flex-col gap-2",
            className
          )}>
          {children}
        </CheckboxGroupPrimitive>
        {errorMessage ? <Field.Error>{errorMessage}</Field.Error> : null}
      </Field.Set>
    </Field.Root>
  );
}

/**
 * Stacked-card group: `CheckboxGroup` wrapping children in `Item.Group`
 * (`role="list"`, `gap-0 select-none`).
 */
export function CheckboxItemGroup({
  children,
  orientation = "vertical",
  ...props
}: CheckboxGroupProps): ReactElement {
  return (
    <CheckboxGroup orientation={orientation} {...props}>
      <CheckboxItemGroupContext.Provider value={true}>
        <Item.Group className="gap-0 select-none">{children}</Item.Group>
      </CheckboxItemGroupContext.Provider>
    </CheckboxGroup>
  );
}

export type CheckboxDescriptionProps = {
  /** Typically a `Checkbox`. */
  children?: ReactNode;
  /**
   * Trailing note. A string renders as a muted `<small>`; a `ReactNode` renders
   * intact. Visual-only — not wired to `aria-describedby`. Use Field description
   * wiring when programmatic association is required.
   */
  describedBy?: string | ReactNode;
};

/**
 * Spec §3: only a string `describedBy` becomes the muted `<small>` note.
 */
function stringDescribedBy(value: string | ReactNode): string | undefined {
  // Consumer-owned ReactNode I/O: a string note is wrapped; a node renders intact.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

/**
 * Inline "checkbox + trailing note" row (checkbox.md §2/§7). The note is
 * visual-only; it does not become an accessible description.
 */
export function CheckboxDescription({ children, describedBy }: CheckboxDescriptionProps): ReactElement {
  const note = stringDescribedBy(describedBy);
  return (
    <div className="flex items-start gap-2">
      {children}
      {note === undefined ? describedBy : <small className="text-sm text-muted-foreground">{note}</small>}
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
 * Labeled selection row over `SelectionItem.Shell` (checkbox.md §2/§7). Client —
 * Field.Item / label wiring (performance.md §RSC classification). Namespace
 * aliases `Title` / `Description` / `Content` / `Actions` / `SubSection` are the
 * exact `SelectionItem.*` objects so `child.type` partitioning works across both
 * spellings.
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
  const inItemGroup = useContext(CheckboxItemGroupContext);
  return (
    <SelectionItem.Shell
      dataSlot="checkbox-item"
      isDisabled={isDisabled}
      controlPosition={controlPosition}
      className={className}
      {...(inItemGroup ? { role: "listitem" as const } : null)}
      control={
        parent === true ? (
          <Checkbox parent disabled={isDisabled} readOnly={isReadOnly} />
        ) : (
          <Checkbox value={value} disabled={isDisabled} readOnly={isReadOnly} />
        )
      }>
      {children}
    </SelectionItem.Shell>
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
