"use client";

import { createContext, use, useEffect, useId, useLayoutEffect, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { fieldLabelCardShellClass } from "../../styles/inner-corner/field-label";
import { labelTypeClass } from "../../styles/label-type";
import { mergeClassName } from "../../styles/merge-class-name";
import { Separator } from "../separator/separator";
import { fieldVariants } from "./field-variants";

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

export function FieldRoot({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<typeof FieldPrimitive.Root> & VariantProps<typeof fieldVariants>): ReactElement {
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

/**
 * Outside a `Field.Root`, the set is described by the `Field.Description` parts it holds, after
 * the consumer's own `aria-describedby`. Inside a root, they describe the root's control instead.
 */
export function FieldSet({
  className,
  ref,
  "aria-describedby": consumerDescribedBy,
  ...props
}: ComponentProps<typeof FieldsetPrimitive.Root>): ReactElement {
  const owner = use(DescriptionOwnerContext);
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
      <FieldsetPrimitive.Root
        ref={mergedRef}
        data-slot="field-set"
        className={mergeClassName(
          className,
          "flex flex-col gap-(--surface-gap-xl) has-[>[data-slot=checkbox-group]]:gap-(--surface-gap-md) has-[>[data-slot=radio-group]]:gap-(--surface-gap-md)"
        )}
        {...definedProps({ ...props, "aria-describedby": describedBy || undefined })}
      />
    </DescriptionOwnerContext.Provider>
  );
}

export function FieldLegend({
  className,
  variant = "legend",
  ...props
}: ComponentProps<typeof FieldsetPrimitive.Legend> & {
  /**
   * Emitted as `data-variant` and drives the text size: `"legend"` (default) titles the
   * fieldset at a fixed 16/24px, `"label"` reads the label type pair to match a `Field.Label`.
   */
  variant?: "legend" | "label";
}): ReactElement {
  return (
    <FieldsetPrimitive.Legend
      data-slot="field-legend"
      data-variant={variant}
      className={mergeClassName(
        className,
        "font-medium data-[variant=label]:text-(length:--label-text) data-[variant=label]:leading-(--label-leading) data-[variant=legend]:text-base mb-3 text-balance"
      )}
      {...definedProps(props)}
    />
  );
}

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

export function FieldContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="field-content"
      className={cn("group/field-content leading-snug flex flex-1 flex-col gap-1", className)}
      {...props}
    />
  );
}

const fieldHeadingClassName = fieldVariants().heading();

/**
 * A label whose direct child is a `Checkbox` renders as a choice row: centered with a pointer
 * cursor. The heading weight is the same as any other label; a consumer `font-*` class wins through
 * the merge.
 */
export function FieldLabel({
  className,
  ...props
}: ComponentProps<typeof FieldPrimitive.Label>): ReactElement {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      data-field-heading=""
      className={mergeClassName(
        className,
        fieldLabelCardShellClass,
        "group/field-label peer/field-label has-data-checked:border-primary/30",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        "has-[>[data-slot=checkbox]]:items-center has-[>[data-slot=checkbox]]:cursor-pointer",
        fieldHeadingClassName
      )}
      {...definedProps(props)}
    />
  );
}

export function FieldTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="field-title"
      data-field-heading=""
      className={cn("items-center", fieldHeadingClassName, className)}
      {...props}
    />
  );
}

export function FieldControl(props: ComponentProps<typeof FieldPrimitive.Control>): ReactElement {
  return <FieldPrimitive.Control data-slot="field-control" {...definedProps(props)} />;
}

type FieldDescriptionProps = ComponentProps<typeof FieldPrimitive.Description>;

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

/**
 * Supporting copy. Inside a `Field.Root` it describes the field's control. Outside any root it
 * renders the same paragraph, and inside a `Field.Set` it describes that fieldset, so a
 * description can follow a `Field.Legend` without a root around the set.
 */
export function FieldDescription({ className, ...props }: FieldDescriptionProps): ReactElement {
  const owner = use(DescriptionOwnerContext);
  const descriptionClassName = mergeClassName(
    className,
    labelTypeClass,
    "font-normal text-left text-pretty text-muted-foreground group-has-data-horizontal/field:text-balance last:mt-0 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary [[data-variant=legend]+&]:-mt-1.5"
  );
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

function documentOrder(left: Node, right: Node): number {
  return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
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

export function FieldItem(props: ComponentProps<typeof FieldPrimitive.Item>): ReactElement {
  return <FieldPrimitive.Item data-slot="field-item" {...props} />;
}

export function FieldSeparator({
  children,
  className,
  ...props
}: ComponentProps<"div"> & {
  /**
   * Optional inline content rendered over the rule — a label for the break between two
   * groups of fields. Its presence is reflected as `data-content`.
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
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content">
          {children}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The field's error message, announced as an alert. Place it directly after the control,
 * ahead of any `Field.Description`, so the message sits right under a field in error, as
 * the labeled composites place theirs.
 *
 * Children are shown as given: the caller decides when the field is in error, and a `match`
 * narrows that to one validity state. Without children it falls through to Base UI's own
 * message, and renders nothing while the field has none: an error from `Form`'s `errors` under
 * the field's name, a `validate` result or the native constraint message, which is in the
 * browser's language. Several messages render as a list.
 */
export function FieldError({
  className,
  children,
  ...props
}: ComponentProps<typeof FieldPrimitive.Error>): ReactElement {
  const errorClassName = mergeClassName(className, labelTypeClass, "font-normal text-error");
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
