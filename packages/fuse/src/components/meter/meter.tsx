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
  /** Visible label, rendered as `Meter.Label`. */
  label?: string;
  /**
   * Color and icon semantics. `"inverted"` is a mode name, not a Tailwind variant.
   * @default "default"
   */
  mode?: MeterMode;
  /** Current value. */
  value: number;
  /**
   * Lower bound, forwarded as base-ui `min`.
   * @default 0
   */
  minValue?: number;
  /**
   * Upper bound, forwarded as base-ui `max`. Also drives `EXCEEDED_MAX_VALUE` when provided.
   * @default 100
   */
  maxValue?: number;
  /** Replaces the auto-formatted `Meter.Value`. */
  valueLabel?: ReactNode;
  /** Accessible name for the Warning icon. Defaults to the locale dictionary. */
  warningLabel?: string;
  /** Accessible name for the CheckCircle icon. Defaults to the locale dictionary. */
  successLabel?: string;
  /** Extra classes, merged onto the root via `cn`. */
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
    return <Warning aria-label={warningName} className={className} />;
  }

  if (icon === "success") {
    return <CheckCircle aria-label={successName} className={className} />;
  }

  return null;
}

/**
 * Labeled meter composite over base-ui Meter. It displays a read-only value and is never
 * an input. Client component, because it reads the locale from the provider.
 */
export function Meter({
  label,
  mode = "default",
  value,
  minValue,
  maxValue,
  valueLabel,
  warningLabel,
  successLabel,
  className,
  ...props
}: MeterProps): ReactElement {
  const { locale } = useLocale();
  const strings = useLocalizedStrings(meterStrings);
  const min = minValue ?? 0;
  const max = maxValue ?? 100;
  const percentage = meterPercentage(value, min, max);
  const level = getMeterLevel(value, maxValue, percentage);
  const warningName = warningLabel ?? strings.format("warning");
  const successName = successLabel ?? strings.format("success");

  const { tone, icon: iconName } = meterToneCell(mode, level);
  const { root, labelContainer, labelValue, icon, bar, barFill } = meterVariants({ tone });

  return (
    <MeterPrimitive.Root
      data-slot="meter"
      value={value}
      min={min}
      max={max}
      locale={locale}
      className={cn(root(), className)}
      {...props}>
      <div className={labelContainer()}>
        <MeterPrimitive.Label data-slot="meter-label" className="text-sm font-medium w-fit">
          {label}
        </MeterPrimitive.Label>
        <span data-slot="meter-value" className={cn(labelValue(), "tabular-nums")}>
          <MeterIcon icon={iconName} className={icon()} warningName={warningName} successName={successName} />{" "}
          {valueLabel ?? <MeterPrimitive.Value />}
        </span>
      </div>
      <MeterPrimitive.Track data-slot="meter-bar" className={bar()}>
        <MeterPrimitive.Indicator data-slot="meter-bar-fill" className={barFill()} />
      </MeterPrimitive.Track>
    </MeterPrimitive.Root>
  );
}

Meter.displayName = "Meter";
