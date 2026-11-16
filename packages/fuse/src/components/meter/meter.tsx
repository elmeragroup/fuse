"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Meter as MeterPrimitive } from "@base-ui/react/meter";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CheckCircle } from "../../icons/generated/check-circle";
import { Warning } from "../../icons/generated/warning";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { getMeterLevel, meterPercentage } from "./get-meter-level";
import { meterStrings } from "./intl";
import type { MeterMode } from "./meter-constants";
import { meterToneCell } from "./meter-tone";
import type { MeterIconName } from "./meter-tone";
import { meterVariants } from "./meter-variants";

export type MeterProps = {
  /** The visible label. */
  label?: string;
  /**
   * What the bar's colour and icon say about the value. The bar is low up to 80% of the range,
   * high above 80%, full at 100% and exceeded above `maxValue`.
   *
   * - `default`: more is worse. Low is success, high is a warning, and full or exceeded is an
   *   error. High, full and exceeded show the warning icon.
   * - `inverted`: more is better. Low is an error, high is a warning, full is success and
   *   exceeded is an error, with no icon.
   * - `success-only-when-full`: only full is success, with the success icon. Every other level
   *   is an error with the warning icon.
   * - `neutral`: the primary colour at every level, with no icon.
   */
  mode?: MeterMode;
  /** The current value. */
  value: number;
  /** The low end of the range. */
  minValue?: number;
  /** The high end of the range. A `value` above it shows as exceeded. */
  maxValue?: number;
  /** Text that replaces the formatted value at the end of the label row, such as `"82 of 120 GB"`. */
  valueLabel?: ReactNode;
  /** The accessible name of the warning icon. Unset, it comes from the locale dictionary. */
  warningLabel?: string;
  /** The accessible name of the success icon. Unset, it comes from the locale dictionary. */
  successLabel?: string;
  /** Extra classes for the root. */
  className?: string;
} & Omit<ComponentProps<typeof MeterPrimitive.Root>, "value" | "min" | "max" | "className" | "locale">;

/**
 * Status icon in the value span. The glyph comes from the same `METER_TONE_TABLE`
 * cell as the fill color, never from the raw percentage, so the icon and the fill
 * always cross the 80% boundary together: exactly 80% is `LOW` and shows no icon in
 * `default` mode.
 */
function MeterIcon({
  icon,
  className,
  warningName,
  successName,
}: {
  icon: MeterIconName;
  className: string;
  warningName: string;
  successName: string;
}): ReactElement | null {
  if (icon === "warning") {
    return <Warning title={warningName} className={className} />;
  }

  if (icon === "success") {
    return <CheckCircle title={successName} className={className} />;
  }

  return null;
}

/**
 * A labeled meter built on Base UI's meter. It shows a read-only value and is never an input.
 * It reads the locale from the provider, so it is a client component.
 */
export function Meter({
  label,
  mode = "default",
  value,
  minValue = 0,
  maxValue = 100,
  valueLabel,
  warningLabel,
  successLabel,
  className,
  ...props
}: MeterProps): ReactElement {
  const { locale } = useLocale();
  const strings = useLocalizedStrings(meterStrings);
  const percentage = meterPercentage(value, minValue, maxValue);
  const level = getMeterLevel(value, maxValue, percentage);
  const warningName = warningLabel ?? strings.format("warning");
  const successName = successLabel ?? strings.format("success");

  const { tone, icon: iconName } = meterToneCell(mode, level);
  const slots = meterVariants({ tone });

  return (
    <MeterPrimitive.Root
      data-slot="meter"
      value={value}
      min={minValue}
      max={maxValue}
      locale={locale}
      className={cn(slots.root(), className)}
      {...props}>
      <div className={slots.labelContainer()}>
        <MeterPrimitive.Label data-slot="meter-label" className={slots.label()}>
          {label}
        </MeterPrimitive.Label>
        <span data-slot="meter-value" className={cn(slots.labelValue(), slots.value())}>
          <MeterIcon
            icon={iconName}
            className={slots.icon()}
            warningName={warningName}
            successName={successName}
          />{" "}
          {valueLabel ?? <MeterPrimitive.Value />}
        </span>
      </div>
      <MeterPrimitive.Track data-slot="meter-bar" className={slots.bar()}>
        <MeterPrimitive.Indicator data-slot="meter-bar-fill" className={slots.barFill()} />
      </MeterPrimitive.Track>
    </MeterPrimitive.Root>
  );
}

Meter.displayName = "Meter";
