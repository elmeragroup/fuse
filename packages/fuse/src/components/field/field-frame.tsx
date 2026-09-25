import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Check } from "../../icons/generated/check";
import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { cn } from "../../styles/cn";
import { iconCrossfadeHidden, iconCrossfadeShown, iconCrossfadeTransition } from "../../styles/utils";
import { Field } from "./index";

/**
 * Package-private FieldFrame layout. No axes — the frame
 * has one layout; TextField's public recipe composes these slots under its own
 * names. The four exported class names below are the same slots, resolved once.
 */
export const fieldFrameVariants = tv({
  slots: {
    root: "group flex flex-col gap-1",
    labelRow: "flex items-center justify-between",
    content: "flex flex-col gap-1",
    description: "text-sm text-pretty",
  },
});

const fieldFrameSlots = fieldFrameVariants();

/** Default `Field.Root` stack for labeled (non-legend) composites. */
export const fieldFrameRootClass = fieldFrameSlots.root();

/**
 * The heading row's own layout. Composites append their own classes (TextareaField the
 * counter gap) through {@link FieldFrameClassNames.labelRow}.
 */
export const fieldFrameLabelRowClass = fieldFrameSlots.labelRow();

/** Default wrapper around control + description when that wrapper is opted into. */
export const fieldFrameContentClass = fieldFrameSlots.content();

/**
 * Default `Field.Description` class. `text-pretty` lives here, not on TextField's public
 * slot: Field.Description already paints it, and PhoneNumberField must not import
 * TextField's recipe to re-state it.
 */
export const fieldFrameDescriptionClass = fieldFrameSlots.description();

/**
 * One class argument per part the frame paints. `content` opts into the
 * control/description wrapper and is the wrapper's class as given — no default merge.
 */
export type FieldFrameClassNames = {
  /** The heading row. */
  labelRow?: string;
  /** `Field.Label` or `Field.Legend`. */
  label?: string;
  /**
   * The content wrapper around control + description. Rendered when this class is
   * given, as this string exactly; omitted, both are direct children of `Field.Root` /
   * `Field.Set`.
   */
  content?: string;
  /** `Field.Description`. */
  description?: string;
};

export type FieldFrameHeading = "label" | "legend";

export type FieldFrameProps = {
  /**
   * How the heading is labelled. `"label"` (default) renders `Field.Label`; `"legend"`
   * wraps the body in `Field.Set` and renders `Field.Legend variant="label"`.
   */
  heading?: FieldFrameHeading;
  /** Visible heading. Falsy renders no label/legend element. */
  label?: string;
  /**
   * Component-owned status face at the end of the heading row — TextareaField's
   * character counter, RadioGroup's pending spinner. Its presence forces the row to
   * exist, the same way `isPending` and `isSuccess` do.
   */
  status?: ReactNode;
  /** Shows the spinner face of the label-row crossfade. */
  isPending?: boolean;
  /** Shows the check face, which wins the crossfade over {@link FieldFrameProps.isPending}. */
  isSuccess?: boolean;
  /** Supporting copy, rendered as `Field.Description` when truthy. */
  description?: ReactNode;
  /** Error copy, rendered as `Field.Error`, which self-suppresses on falsy children. */
  errorMessage?: ReactNode;
  /** Forwarded to `Field.Root`. */
  invalid?: boolean;
  /** Forwarded to `Field.Root`. */
  disabled?: boolean;
  /** Forwarded to `Field.Root`. CheckboxGroup threads its `name` here. */
  name?: string;
  /** Extra classes, merged onto `Field.Root`. */
  className?: string;
  /** Per-part classes; see {@link FieldFrameClassNames}. */
  classNames?: FieldFrameClassNames;
  /** The control this frame labels. */
  children: ReactNode;
};

/**
 * Package-private heading/description/error frame for every labeled composite.
 * `heading="legend"` is the fieldset skeleton CheckboxGroup and
 * RadioGroup used to rebuild beside this module.
 *
 * It is not exported through `package.json#exports` and has no client directive. It owns
 * no state and its consumers are already client modules, so a directive would only widen
 * the client graph. `source-contracts.test.ts` keeps it directive-free.
 *
 * Keep exactly one `Field.Root` per composite so a nested root cannot break label wiring.
 */
export function FieldFrame({
  heading = "label",
  label,
  status,
  isPending = false,
  isSuccess = false,
  description,
  errorMessage,
  invalid,
  disabled,
  name,
  className,
  classNames,
  children,
}: FieldFrameProps): ReactElement {
  const hasCrossfade = isPending || isSuccess;
  const headingClass = classNames?.label;
  const descriptionNode = description ? (
    <Field.Description className={cn(fieldFrameDescriptionClass, classNames?.description)}>
      {description}
    </Field.Description>
  ) : null;
  const body =
    heading === "legend" ? (
      <>
        {descriptionNode}
        {children}
      </>
    ) : (
      <>
        {children}
        {descriptionNode}
      </>
    );
  const content = classNames?.content === undefined ? body : <div className={classNames.content}>{body}</div>;
  const headingRow =
    label || status != null || hasCrossfade ? (
      <div className={cn(fieldFrameLabelRowClass, classNames?.labelRow)}>
        {label ? (
          heading === "legend" ? (
            <Field.Legend variant="label" className={headingClass}>
              {label}
            </Field.Legend>
          ) : (
            <Field.Label className={headingClass}>{label}</Field.Label>
          )
        ) : null}
        {status}
        {hasCrossfade ? (
          <div className="relative size-3.5">
            <SpinnerGap
              aria-hidden
              className={cn(
                "animate-spin absolute inset-0 m-auto size-3",
                iconCrossfadeTransition,
                isSuccess ? iconCrossfadeHidden : iconCrossfadeShown
              )}
            />
            <Check
              aria-hidden
              className={cn(
                "absolute inset-0 m-auto size-3.5",
                iconCrossfadeTransition,
                isSuccess ? iconCrossfadeShown : iconCrossfadeHidden
              )}
            />
          </div>
        ) : null}
      </div>
    ) : null;
  const framed = (
    <>
      {headingRow}
      {content}
      <Field.Error>{errorMessage}</Field.Error>
    </>
  );

  return (
    <Field.Root name={name} invalid={invalid} disabled={disabled} className={className}>
      {heading === "legend" ? <Field.Set>{framed}</Field.Set> : framed}
    </Field.Root>
  );
}

FieldFrame.displayName = "FieldFrame";
