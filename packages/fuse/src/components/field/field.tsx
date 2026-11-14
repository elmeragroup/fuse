"use client";

import { createContext, use, useEffect, useId, useLayoutEffect, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { documentOrder } from "../../internal/dom-node";
import { FieldSetDisabledContext } from "../../internal/field-set-disabled";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Separator } from "../separator/separator";
import { fieldLegendVariants, fieldVariants } from "./field-variants";

/** How a `Field.Set` collects the description elements it holds. */
type DescriptionRegistry = {
  /** Track a mounted description element; the returned function stops tracking it. */
  readonly add: (element: HTMLElement) => () => void;
};

/**
 * What a `Field.Description` describes. Base UI's part throws outside a `Field.Root`, so the
 * root marks its subtree and a `Field.Set` outside any root collects the descriptions it holds.
 * Without either, the description is plain text.
 */
type DescriptionOwner = { readonly _tag: "field" } | ({ readonly _tag: "fieldset" } & DescriptionRegistry);

const DescriptionOwnerContext = createContext<DescriptionOwner | null>(null);

const fieldDescriptionOwner: DescriptionOwner = { _tag: "field" };

/** The props of `Field.Root`. */
type FieldRootProps = ComponentProps<typeof FieldPrimitive.Root> &
  VariantProps<typeof fieldVariants> & {
    /**
     * How the parts sit, also written as `data-orientation`. `vertical` stacks the label, control,
     * error and description 4px apart at both densities, as the labeled composites do, so a field
     * built from parts lines up with a `TextField` beside it. It stretches each child to the
     * field's width, except a `Checkbox` or `Switch`. `horizontal` sets the control beside its
     * label, a gap apart that follows density. `responsive` is vertical until the nearest
     * `Field.Group` is 28rem wide, then horizontal. Outside a `Field.Group` it stays vertical.
     */
    orientation?: VariantProps<typeof fieldVariants>["orientation"];
  };

/**
 * A field: it links its `Field.Label`, `Field.Description` and `Field.Error` to the control
 * inside it, and holds the control's disabled, invalid and validation state.
 */
export function FieldRoot({ className, orientation = "vertical", ...props }: FieldRootProps): ReactElement {
  return (
    <DescriptionOwnerContext.Provider value={fieldDescriptionOwner}>
      <FieldPrimitive.Root
        data-slot="field"
        data-orientation={orientation}
        className={mergeClassName(className, fieldVariants({ orientation }).root())}
        {...props}
      />
    </DescriptionOwnerContext.Provider>
  );
}

type FieldsetRootProps = ComponentProps<typeof FieldsetPrimitive.Root>;

/** The props of `Field.Set`. */
type FieldSetProps = Omit<FieldsetRootProps, "aria-describedby" | "disabled"> & {
  /**
   * The ids of elements that describe the set. Outside a `Field.Root`, the set adds the ids of the
   * `Field.Description` parts it holds after these. Inside a root, those descriptions describe the
   * root's control instead.
   */
  "aria-describedby"?: FieldsetRootProps["aria-describedby"];
  /**
   * Disables every field in the set. A set inside a disabled set is disabled too. It also
   * disables the parts that are not a field themselves, such as a date picker's trigger and
   * calendar.
   */
  disabled?: FieldsetRootProps["disabled"];
};

/**
 * A native fieldset that groups related fields under a `Field.Legend`. The disabled state reaches
 * the non-field parts through `internal/field-set-disabled.ts`.
 */
export function FieldSet({
  className,
  ref,
  "aria-describedby": consumerDescribedBy,
  ...props
}: FieldSetProps): ReactElement {
  const owner = use(DescriptionOwnerContext);
  const disabled = use(FieldSetDisabledContext) || props.disabled === true;
  // A joined string, so an unchanged order bails out of the state update instead of re-rendering.
  const [descriptionIds, setDescriptionIds] = useState("");
  const [{ fieldsetOwner, sync }] = useState(() => {
    const elements = new Set<HTMLElement>();
    const sync = () =>
      setDescriptionIds(
        [...elements]
          .sort(documentOrder)
          .map((element) => element.id)
          .join(" ")
      );
    const fieldsetOwner: DescriptionOwner = {
      _tag: "fieldset",
      add: (element) => {
        elements.add(element);
        sync();
        return () => {
          elements.delete(element);
          sync();
        };
      },
    };
    return { fieldsetOwner, sync };
  });
  const [fieldset, setFieldset] = useState<HTMLElement | null>(null);
  const mergedRef = useMergedRefs(ref, setFieldset);
  const ownsDescriptions = owner?._tag !== "field";
  // A reorder can move memoized descriptions without re-rendering them, and an id can change
  // without a re-registration, so the set watches its own subtree rather than each description.
  useEffect(() => {
    if (!fieldset || !ownsDescriptions) return;
    const observer = new MutationObserver(sync);
    observer.observe(fieldset, { childList: true, subtree: true, attributeFilter: ["id"] });
    return () => observer.disconnect();
  }, [fieldset, ownsDescriptions, sync]);
  const describedBy = [consumerDescribedBy, descriptionIds].filter(Boolean).join(" ");
  return (
    <DescriptionOwnerContext.Provider value={ownsDescriptions ? fieldsetOwner : owner}>
      <FieldSetDisabledContext value={disabled}>
        <FieldsetPrimitive.Root
          ref={mergedRef}
          data-slot="field-set"
          className={mergeClassName(className, fieldSetClassName)}
          {...definedProps({ ...props, "aria-describedby": describedBy || undefined })}
        />
      </FieldSetDisabledContext>
    </DescriptionOwnerContext.Provider>
  );
}

type FieldsetLegendProps = ComponentProps<typeof FieldsetPrimitive.Legend>;

/** The props of `Field.Legend`. */
type FieldLegendProps = Omit<FieldsetLegendProps, "render"> & {
  /**
   * The text size, also written as `data-variant`. `legend` titles the set at a fixed 16px on a
   * 24px line. `label` takes the label text size, to match a `Field.Label`.
   */
  variant?: "legend" | "label";
  /**
   * Replaces the rendered element, a `div` by default. In a grid `Field.Set`, pass
   * `render={<legend />}`: the browser keeps a fieldset's first `legend` out of the grid, so the
   * first field takes the first cell, and the legend still names the set. A `div` legend takes
   * the first cell itself.
   */
  render?: FieldsetLegendProps["render"];
};

/** The title of a `Field.Set`, which names the set. */
export function FieldLegend({ className, variant = "legend", ...props }: FieldLegendProps): ReactElement {
  return (
    <FieldsetPrimitive.Legend
      data-slot="field-legend"
      data-variant={variant}
      className={mergeClassName(className, fieldLegendVariants({ variant }))}
      {...definedProps(props)}
    />
  );
}

/**
 * A column of fields, with a wider gap between fields than inside one. A `Field.Root` with
 * `orientation="responsive"` reads its width.
 */
export function FieldGroup({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-(--surface-gap-xl) *:data-[slot=checkbox-group]:gap-(--surface-gap-md) *:data-[slot=field-group]:gap-(--surface-gap-lg) *:data-[slot=radio-group]:gap-(--surface-gap-md)",
        className
      )}
      {...props}
    />
  );
}

/** A column for a `Field.Title` and `Field.Description` beside a control in a horizontal root. */
export function FieldContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="field-content"
      className={cn("group/field-content leading-snug flex flex-1 flex-col gap-1", className)}
      {...props}
    />
  );
}

const fieldSetClassName = fieldVariants().set();

const fieldTitleClassName = fieldVariants().title();

const fieldLabelClassName = fieldVariants().label();

const fieldDescriptionClassName = fieldVariants().description();

const fieldErrorClassName = fieldVariants().error();

type FieldLabelPrimitiveProps = ComponentProps<typeof FieldPrimitive.Label>;

/** The props of `Field.Label`. */
type FieldLabelProps = Omit<FieldLabelPrimitiveProps, "children"> & {
  /**
   * The label text. With a `Checkbox` as a direct child, the label is a choice row with a pointer
   * cursor. With a horizontal `Field.Root` as its child, holding the `Checkbox` and a
   * `Field.Content`, the label is a bordered choice card. The checkbox then belongs to the inner
   * root, so set `htmlFor` to the checkbox's `id`.
   */
  children?: FieldLabelPrimitiveProps["children"];
};

/** The visible label of the control in its `Field.Root`. */
export function FieldLabel({ className, ...props }: FieldLabelProps): ReactElement {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      data-field-heading=""
      className={mergeClassName(className, fieldLabelClassName)}
      {...definedProps(props)}
    />
  );
}

/** A heading for a control that a `Field.Label` around it already names, as in a choice card. */
export function FieldTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="field-title"
      data-field-heading=""
      className={cn(fieldTitleClassName, className)}
      {...props}
    />
  );
}

/**
 * An unstyled native `input` wired to its `Field.Root`. Pass a control that does not wire itself,
 * such as `Textarea`, to its `render`.
 */
export function FieldControl(props: ComponentProps<typeof FieldPrimitive.Control>): ReactElement {
  return <FieldPrimitive.Control data-slot="field-control" {...definedProps(props)} />;
}

type FieldDescriptionPrimitiveProps = ComponentProps<typeof FieldPrimitive.Description>;

/** The props of `Field.Description`. */
type FieldDescriptionProps = Omit<FieldDescriptionPrimitiveProps, "children"> & {
  /**
   * The supporting text. Inside a `Field.Root` it describes the root's control. Inside a
   * `Field.Set` and outside any root, it describes the set, so it can follow a `Field.Legend`.
   * Elsewhere it is a plain paragraph.
   */
  children?: FieldDescriptionPrimitiveProps["children"];
};

/**
 * The state Base UI's description reports for a field nobody has touched. Mapped so the type
 * satisfies `useRender`'s record constraint, which the source interface does not.
 */
type UnownedDescriptionState = {
  readonly [K in keyof FieldPrimitive.Description.State]: FieldPrimitive.Description.State[K];
};

const unownedDescriptionState: UnownedDescriptionState = {
  disabled: false,
  touched: false,
  dirty: false,
  valid: null,
  filled: false,
  focused: false,
};

/** Supporting text for a field or a set. */
export function FieldDescription({ className, ...props }: FieldDescriptionProps): ReactElement {
  const owner = use(DescriptionOwnerContext);
  const descriptionClassName = mergeClassName(className, fieldDescriptionClassName);
  if (owner?._tag === "field") {
    return (
      <FieldPrimitive.Description
        data-slot="field-description"
        className={descriptionClassName}
        {...definedProps(props)}
      />
    );
  }
  return (
    <UnownedDescription
      registry={owner?._tag === "fieldset" ? owner : undefined}
      className={descriptionClassName}
      {...props}
    />
  );
}

function UnownedDescription({
  registry,
  className,
  style,
  render,
  ref,
  id,
  ...props
}: FieldDescriptionProps & { registry: DescriptionRegistry | undefined }): ReactElement {
  const generatedId = useId();
  const [element, setElement] = useState<HTMLParagraphElement | null>(null);
  useLayoutEffect(() => (element ? registry?.add(element) : undefined), [registry, element]);
  return useRender<UnownedDescriptionState, HTMLParagraphElement>({
    defaultTagName: "p",
    render,
    ref: ref ? [ref, setElement] : setElement,
    state: unownedDescriptionState,
    props: {
      "data-slot": "field-description",
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public className contract accepts strings or state callbacks; useRender does not resolve them.
      className: typeof className === "function" ? className(unownedDescriptionState) : className,
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public style contract accepts objects or state callbacks; useRender does not resolve them.
      style: typeof style === "function" ? style(unownedDescriptionState) : style,
      ...definedProps(props),
      id: id ?? generatedId,
    },
  });
}

/** One choice in a group of checkboxes or radios that shares one `Field.Root`. */
export function FieldItem(props: ComponentProps<typeof FieldPrimitive.Item>): ReactElement {
  return <FieldPrimitive.Item data-slot="field-item" {...definedProps(props)} />;
}

export function FieldSeparator({
  children,
  className,
  ...props
}: ComponentProps<"div"> & {
  /**
   * Text over the rule, such as a name for the fields after it. The separator writes
   * `data-content="true"` when it has children.
   */
  children?: ReactNode;
}): ReactElement {
  return (
    <div
      data-slot="field-separator"
      data-content={children ? "true" : "false"}
      className={cn("text-sm relative -my-2 h-5 group-data-[variant=outline]/field-group:-mb-2", className)}
      {...props}>
      <Separator className="absolute inset-0 top-1/2" />
      {children ? (
        <span
          className="relative mx-auto block w-fit bg-[var(--surface,var(--background))] px-2 text-[color:var(--surface-muted-foreground,var(--muted-foreground))]"
          data-slot="field-separator-content">
          {children}
        </span>
      ) : null}
    </div>
  );
}

type FieldErrorPrimitiveProps = ComponentProps<typeof FieldPrimitive.Error>;

/** The props of `Field.Error`. */
type FieldErrorProps = Omit<FieldErrorPrimitiveProps, "children"> & {
  /**
   * The message. Children always show, so render the part only while the field is in error, or
   * pass `match` to show them for one validity state. Without children, the part shows the
   * field's own message, and nothing while it has none: an error `Form` holds under the field's
   * name, a `validate` result on `Field.Root`, or the browser's constraint message, which is in
   * the browser's language. Several messages render as a list. To localize the message, pass
   * children or a `validate` that returns your copy. Place the part directly after the control,
   * ahead of any `Field.Description`, as the labeled composites do.
   */
  children?: FieldErrorPrimitiveProps["children"];
};

/** The field's error message, announced as an alert. */
export function FieldError({ className, children, ...props }: FieldErrorProps): ReactElement {
  const errorClassName = mergeClassName(className, fieldErrorClassName);
  // Two branches, not `match={children ? true : undefined}`: Base UI merges every present
  // key, so a forwarded `children={undefined}` would erase the message it renders itself.
  if (!children) {
    return (
      <FieldPrimitive.Error
        role="alert"
        data-slot="field-error"
        className={errorClassName}
        {...definedProps(props)}
      />
    );
  }
  return (
    <FieldPrimitive.Error
      match
      role="alert"
      data-slot="field-error"
      className={errorClassName}
      {...definedProps(props)}>
      {children}
    </FieldPrimitive.Error>
  );
}

FieldRoot.displayName = "Field.Root";
FieldLabel.displayName = "Field.Label";
FieldDescription.displayName = "Field.Description";
FieldError.displayName = "Field.Error";
FieldControl.displayName = "Field.Control";
FieldItem.displayName = "Field.Item";
FieldContent.displayName = "Field.Content";
FieldGroup.displayName = "Field.Group";
FieldSet.displayName = "Field.Set";
FieldLegend.displayName = "Field.Legend";
FieldSeparator.displayName = "Field.Separator";
FieldTitle.displayName = "Field.Title";
