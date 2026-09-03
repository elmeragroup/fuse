import type { ReactElement, ReactNode } from "react";

import { Check } from "../../icons/generated/check";
import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { cn } from "../../styles/cn";
import { iconCrossfadeHidden, iconCrossfadeShown, iconCrossfadeTransition } from "../../styles/utils";
import { Field } from "./field";

/**
 * The label row's own layout, shared by every composite that frames a control. The row
 * is a single flex line with the label at the start and the status face at the end;
 * composites append their own classes (TextField its public `labelContainer` slot,
 * TextareaField the counter gap) as the extra `cn` argument.
 */
const fieldFrameLabelRowClass = "flex items-center justify-between";

export type FieldFrameProps = {
  /** Visible label, rendered as `Field.Label`. Falsy renders no label. */
  label?: string;
  /** Extra classes for the `Field.Label` (TextField's `label` recipe slot). */
  labelClassName?: string;
  /** Extra classes for the label row itself. */
  labelRowClassName?: string;
  /**
   * Component-owned status face rendered at the end of the label row — TextareaField's
   * character counter. Its presence forces the row to exist, the same way `isPending`
   * and `isSuccess` do.
   */
  status?: ReactNode;
  /** Shows the spinner face of the label-row crossfade. */
  isPending?: boolean;
  /** Shows the check face, which wins the crossfade over {@link FieldFrameProps.isPending}. */
  isSuccess?: boolean;
  /** Supporting copy, rendered as `Field.Description` when truthy. */
  description?: ReactNode;
  /** Extra classes for the `Field.Description`. */
  descriptionClassName?: string;
  /**
   * When set, the control and the description are wrapped in a `div` carrying these
   * classes — TextField's `container` slot, which turns the pair into a row under
   * `variant="card"`. Unset, both are direct children of `Field.Root`.
   */
  contentClassName?: string;
  /** Error copy, rendered as `Field.Error`, which self-suppresses on falsy children. */
  errorMessage?: ReactNode;
  /** Forwarded to `Field.Root`. */
  invalid?: boolean;
  /** Forwarded to `Field.Root`. */
  disabled?: boolean;
  /** Classes for the root, already merged by the composite. */
  className?: string;
  /** The control this frame labels. */
  children: ReactNode;
};

/**
 * Package-private label/status/description/error frame for the labeled field composites
 * (field.md §8.9; spec 08 finding S18). TextField, NumberField and TextareaField had
 * rebuilt this shape three times and had already drifted — TextField crossfaded the
 * pending and success glyphs while NumberField stacked both side by side
 * (number-field.md §8.7).
 *
 * It is not exported through `package.json#exports` and carries no client directive: it
 * owns no state, and all three consumers are client modules already, so a directive here
 * would only widen the client graph (performance.md §3; `source-contracts.test.ts` pins
 * the classification, as it does for the shared overlay close button).
 *
 * **It does not nest a second `Field.Root`.** The card-style label shape that field.md
 * §7 warns about — a nested root shadowing the outer registration and leaving the
 * control unnamed — is exactly one `Field.Root` per composite here, as before.
 */
export function FieldFrame({
  label,
  labelClassName,
  labelRowClassName,
  status,
  isPending = false,
  isSuccess = false,
  description,
  descriptionClassName,
  contentClassName,
  errorMessage,
  invalid,
  disabled,
  className,
  children,
}: FieldFrameProps): ReactElement {
  const hasCrossfade = isPending || isSuccess;
  const descriptionNode = description ? (
    <Field.Description className={descriptionClassName}>{description}</Field.Description>
  ) : null;

  return (
    <Field.Root invalid={invalid} disabled={disabled} className={className}>
      {label || status != null || hasCrossfade ? (
        <div className={cn(fieldFrameLabelRowClass, labelRowClassName)}>
          {label ? <Field.Label className={labelClassName}>{label}</Field.Label> : null}
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
      ) : null}
      {contentClassName === undefined ? (
        <>
          {children}
          {descriptionNode}
        </>
      ) : (
        <div className={contentClassName}>
          {children}
          {descriptionNode}
        </div>
      )}
      <Field.Error>{errorMessage}</Field.Error>
    </Field.Root>
  );
}

FieldFrame.displayName = "FieldFrame";
