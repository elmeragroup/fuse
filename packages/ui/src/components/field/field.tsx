"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { Separator } from "../separator/separator";

const fieldVariants = tv({
  base: "group/field flex w-full gap-3 data-invalid:text-error",
  variants: {
    orientation: {
      vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
      horizontal:
        "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-field-heading:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      responsive:
        "@md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-field-heading:flex-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px flex-col *:w-full [&>.sr-only]:w-auto",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

function FieldRoot({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<typeof FieldPrimitive.Root> & VariantProps<typeof fieldVariants>): ReactElement {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldSet({ className, ...props }: ComponentProps<typeof FieldsetPrimitive.Root>): ReactElement {
  return (
    <FieldsetPrimitive.Root
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: ComponentProps<typeof FieldsetPrimitive.Legend> & { variant?: "legend" | "label" }): ReactElement {
  return (
    <FieldsetPrimitive.Legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base mb-3 text-balance",
        className
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
        className
      )}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="field-content"
      className={cn("group/field-content leading-snug flex flex-1 flex-col gap-1", className)}
      {...props}
    />
  );
}

const fieldHeadingClassName = "flex w-fit gap-2 text-sm font-medium group-data-disabled/field:opacity-50";

function FieldLabel({ className, ...props }: ComponentProps<typeof FieldPrimitive.Label>): ReactElement {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      data-field-heading=""
      className={cn(
        "group/field-label peer/field-label leading-snug has-data-checked:border-primary/30 has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border *:data-[slot=field]:p-3",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        fieldHeadingClassName,
        className
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="field-title"
      data-field-heading=""
      className={cn("items-center", fieldHeadingClassName, className)}
      {...props}
    />
  );
}

function FieldControl(props: ComponentProps<typeof FieldPrimitive.Control>): ReactElement {
  return <FieldPrimitive.Control data-slot="field-control" {...props} />;
}

function FieldDescription({
  className,
  ...props
}: ComponentProps<typeof FieldPrimitive.Description>): ReactElement {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn(
        "text-sm leading-normal font-normal text-left text-pretty text-muted-foreground group-has-data-horizontal/field:text-balance last:mt-0 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary [[data-variant=legend]+&]:-mt-1.5",
        className
      )}
      {...props}
    />
  );
}

function FieldItem(props: ComponentProps<typeof FieldPrimitive.Item>): ReactElement {
  return <FieldPrimitive.Item data-slot="field-item" {...props} />;
}

function FieldSeparator({
  children,
  className,
  ...props
}: ComponentProps<"div"> & { children?: ReactNode }): ReactElement {
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

function FieldError({
  className,
  children,
  ...props
}: ComponentProps<typeof FieldPrimitive.Error>): ReactElement | null {
  if (!children) {
    return null;
  }
  return (
    <FieldPrimitive.Error
      match
      role="alert"
      data-slot="field-error"
      className={cn("text-sm font-normal text-error", className)}
      {...props}>
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

export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Description: FieldDescription,
  Error: FieldError,
  Control: FieldControl,
  Item: FieldItem,
  Content: FieldContent,
  Group: FieldGroup,
  Set: FieldSet,
  Legend: FieldLegend,
  Separator: FieldSeparator,
  Title: FieldTitle,
};
