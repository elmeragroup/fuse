import type { ReactElement, ReactNode } from "react";

import { Check } from "../../icons/generated/check";
import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { iconCrossfadeHidden, iconCrossfadeShown, iconCrossfadeTransition } from "../../styles/utils";
import { FieldDescription, FieldError, FieldLabel, FieldLegend, FieldRoot, FieldSet } from "./field";
import { fieldFrameVariants } from "./field-frame-variants";

const fieldFrameSlots = fieldFrameVariants();
const legendDescriptionSlots = fieldFrameVariants({ legendDescription: true });

/**
 * A label frame's root class. Its 4px stack restates the vertical `Field.Root`'s, since TextField's
 * public recipe composes this slot as its `base`.
 */
const fieldFrameRootClass = fieldFrameSlots.root();

/**
 * The heading row's own layout. Composites append their own classes, such as TextareaField's
 * counter gap, through {@link FieldFrameClassNames.labelRow}.
 */
const fieldFrameLabelRowClass = fieldFrameSlots.labelRow();

/**
 * Default `Field.Description` class. `text-pretty` lives here, not on TextField's public slot,
 * because `Field.Description` already paints it and PhoneNumberField must not import TextField's
 * recipe to restate it.
 */
const fieldFrameDescriptionClass = fieldFrameSlots.description();

/**
 * One class argument per part the frame paints. `content` opts into the
 * control, error and description wrapper and is the wrapper's class as given, with no default
 * merge.
 */
export type FieldFrameClassNames = {
  /** The heading row. */
  labelRow?: string;
  /** `Field.Label` or `Field.Legend`. */
  label?: string;
  /**
   * The content wrapper around the control, its error and its description. The frame renders it
   * when this class is given, with this string as its exact class. Without it, they are direct
   * children of `Field.Root` or `Field.Set`. With {@link FieldFrameProps.isDescriptionBeside}, the
   * error follows the wrapper.
   */
  content?: string;
  /** `Field.Description`. */
  description?: string;
};

type FieldFrameHeading = "label" | "legend";

export type FieldFrameProps = {
  /**
   * How the heading is labeled. `"label"` renders `Field.Label`; `"legend"`
   * wraps the body in `Field.Set` and renders `Field.Legend variant="label"`.
   */
  heading?: FieldFrameHeading;
  /** The visible heading. A falsy value renders no label or legend element. */
  label?: string;
  /**
   * Whether the label or legend is visually hidden and kept as the accessible name. Without a
   * status face the whole heading row is `sr-only` too, so the body starts at the top. With one,
   * the row stays for the status.
   */
  isLabelHidden?: boolean;
  /**
   * A component-owned status face at the end of the heading row, such as TextareaField's
   * character counter or RadioGroup's pending spinner. Its presence forces the row to exist, as
   * `isPending` and `isSuccess` do.
   */
  status?: ReactNode;
  /** Whether the label-row crossfade shows its spinner face. */
  isPending?: boolean;
  /**
   * Whether the label-row crossfade shows its check face, which wins over
   * {@link FieldFrameProps.isPending}.
   */
  isSuccess?: boolean;
  /** Supporting copy, which the frame renders as `Field.Description` when it is truthy. */
  description?: ReactNode;
  /**
   * Error copy, which the frame renders as `Field.Error`. When it is falsy, the field shows its own
   * validation error.
   */
  errorMessage?: ReactNode;
  /**
   * Whether `errorMessage` shows whenever it is given, or only while the field fails its own
   * validation or holds a `Form` error, so a composite that is not forced invalid keeps its message
   * for a failed check. The frame forwards it to `Field.Error`'s `match` when `errorMessage` is
   * given.
   * @default true
   */
  isErrorMessageAlwaysShown?: boolean;
  /**
   * Whether the content wrapper lays the description out beside the control, as TextField's card row
   * does, so the error goes under the wrapper instead of joining the row. The control keeps its
   * place in the tree either way, so toggling this does not remount it.
   */
  isDescriptionBeside?: boolean;
  /**
   * The composite's variant, written as `data-variant` on `Field.Root`. TextField's card root is
   * the card, which pads with the surface metrics, so the density-role table keys it on this.
   */
  variant?: "card" | "inline";
  /**
   * Whether the composite's value is empty, which writes `data-empty` on the root, as SearchField
   * does to hide its clear button.
   */
  isEmpty?: boolean;
  /** Whether the field is invalid, forwarded to `Field.Root`. */
  invalid?: boolean;
  /** Whether the field is disabled, forwarded to `Field.Root`. */
  disabled?: boolean;
  /** The field's name, forwarded to `Field.Root`. CheckboxGroup passes its `name` here. */
  name?: string;
  /** Extra classes, merged onto `Field.Root`. */
  className?: string;
  /** Per-part classes, as {@link FieldFrameClassNames} lists them. */
  classNames?: FieldFrameClassNames;
  /** The control this frame labels. */
  children: ReactNode;
};

/**
 * The package-private heading, description and error frame for every labeled composite.
 * `heading="legend"` is the fieldset skeleton CheckboxGroup and RadioGroup used to rebuild beside
 * this module.
 *
 * It is not exported through `package.json#exports` and has no client directive. It owns
 * no state. Most consumers are client modules, but SelectField, AutocompleteField and
 * ComboboxField are server components that render it, so FieldFrame must stay hook-free, and a
 * directive would only widen the client graph.
 *
 * Keep exactly one `Field.Root` per composite so a nested root cannot break label wiring.
 */
export function FieldFrame({
  heading = "label",
  label,
  isLabelHidden = false,
  status,
  isPending = false,
  isSuccess = false,
  description,
  errorMessage,
  isErrorMessageAlwaysShown = true,
  isDescriptionBeside = false,
  variant,
  isEmpty = false,
  invalid,
  disabled,
  name,
  className,
  classNames,
  children,
}: FieldFrameProps): ReactElement {
  const hasCrossfade = isPending || isSuccess;
  const hasStatus = status != null || hasCrossfade;
  // Only a visible legend leaves a margin and a fieldset gap above the description to
  // cancel. Without one the description opens the fieldset, and a status-only row keeps
  // the group gap. A visually hidden legend is out of flow, so it leaves nothing to cancel.
  const legendDescription = heading === "legend" && Boolean(label) && !isLabelHidden && Boolean(description);
  // `sr-only` takes the hidden part out of flow, so it leaves no row height or gap. The
  // row goes with the label only when no status face needs it.
  const headingClass = cn(
    isLabelHidden && "sr-only",
    legendDescription && legendDescriptionSlots.label(),
    classNames?.label
  );
  const descriptionNode = description ? (
    <FieldDescription
      className={cn(
        legendDescription ? legendDescriptionSlots.description() : fieldFrameDescriptionClass,
        classNames?.description
      )}>
      {description}
    </FieldDescription>
  ) : null;
  // A legend-mode description sits under the legend, above the options. A label-mode one
  // follows the control.
  const leadingDescription = heading === "legend" ? descriptionNode : null;
  const trailingDescription = heading === "legend" ? null : descriptionNode;
  // A FieldError with copy shows it always through `match`, and drops an undefined `match`.
  // `false` is not "never": Base UI reads any `match` other than `true` or a validity key as its
  // default, which shows the copy while the field is invalid or holds a Form error.
  const errorNode = (
    <FieldError match={isErrorMessageAlwaysShown ? undefined : false}>{errorMessage}</FieldError>
  );
  // The error sits directly under the control, ahead of a trailing description, so a field in
  // error shows its message there, as the Figma design does. A description beside the control shares its row,
  // so the error goes under the whole content instead.
  const body = (
    <>
      {leadingDescription}
      {children}
      {isDescriptionBeside ? null : errorNode}
      {trailingDescription}
    </>
  );
  const content = classNames?.content === undefined ? body : <div className={classNames.content}>{body}</div>;
  const headingRow =
    label || hasStatus ? (
      <div
        className={cn(
          fieldFrameLabelRowClass,
          isLabelHidden && !hasStatus && "sr-only",
          classNames?.labelRow
        )}>
        {label ? (
          heading === "legend" ? (
            <FieldLegend variant="label" className={headingClass}>
              {label}
            </FieldLegend>
          ) : (
            <FieldLabel className={headingClass}>{label}</FieldLabel>
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
      {isDescriptionBeside ? errorNode : null}
    </>
  );

  return (
    <FieldRoot
      {...definedProps({
        "data-variant": variant,
        "data-empty": isEmpty ? "" : undefined,
        name,
        invalid,
        disabled,
      })}
      className={cn(heading === "label" ? fieldFrameRootClass : null, className)}>
      {heading === "legend" ? <FieldSet>{framed}</FieldSet> : framed}
    </FieldRoot>
  );
}

FieldFrame.displayName = "FieldFrame";
