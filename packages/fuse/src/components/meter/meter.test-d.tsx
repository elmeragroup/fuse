import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { Meter as RootMeter, METER_CONSTANTS as RootMeterConstants } from "@elmeragroup/fuse";
import type { MeterProps } from "@elmeragroup/fuse/meter";
import { Meter, METER_CONSTANTS } from "@elmeragroup/fuse/meter";

test("Meter and METER_CONSTANTS ship from the meter entry and the root barrel", () => {
  expectTypeOf<typeof Meter>().toEqualTypeOf<typeof RootMeter>();
  expectTypeOf<typeof METER_CONSTANTS>().toEqualTypeOf<typeof RootMeterConstants>();
  expectTypeOf(Meter).toBeFunction();
});

test("MeterProps is the labeled composite face without locale or primitive min/max", () => {
  expectTypeOf<MeterProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<MeterProps["mode"]>().toEqualTypeOf<
    "default" | "inverted" | "success-only-when-full" | "neutral" | undefined
  >();
  expectTypeOf<MeterProps["value"]>().toEqualTypeOf<number>();
  expectTypeOf<MeterProps["minValue"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<MeterProps["maxValue"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<MeterProps["valueLabel"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<MeterProps["warningLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<MeterProps["successLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<MeterProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<MeterProps>().toHaveProperty("format");
  expectTypeOf<MeterProps>().toHaveProperty("getAriaValueText");
  expectTypeOf<MeterProps>().not.toHaveProperty("locale");
  expectTypeOf<MeterProps>().not.toHaveProperty("size");
  expectTypeOf<MeterProps>().not.toHaveProperty("min");
  expectTypeOf<MeterProps>().not.toHaveProperty("max");
  expectTypeOf<MeterProps>().not.toHaveProperty("as");
});

test("METER_CONSTANTS exposes the public mode and level names", () => {
  expectTypeOf(METER_CONSTANTS.MODES.DEFAULT).toEqualTypeOf<"default">();
  expectTypeOf(METER_CONSTANTS.MODES.INVERTED).toEqualTypeOf<"inverted">();
  expectTypeOf(METER_CONSTANTS.MODES.SUCCESS_ONLY_WHEN_FULL).toEqualTypeOf<"success-only-when-full">();
  expectTypeOf(METER_CONSTANTS.MODES.NEUTRAL).toEqualTypeOf<"neutral">();
  expectTypeOf(METER_CONSTANTS.LEVELS.LOW).toEqualTypeOf<"LOW">();
  expectTypeOf(METER_CONSTANTS.LEVELS.MEDIUM).toEqualTypeOf<"MEDIUM">();
  expectTypeOf(METER_CONSTANTS.LEVELS.FULL).toEqualTypeOf<"FULL">();
  expectTypeOf(METER_CONSTANTS.LEVELS.EXCEEDED_MAX_VALUE).toEqualTypeOf<"EXCEEDED_MAX_VALUE">();
});

test("the element takes the public props and no locale, size, or primitive aliases", () => {
  const _basic = <Meter label="Storage used" value={82} />;
  const _range = (
    <Meter
      label="Storage used"
      value={82}
      minValue={0}
      maxValue={120}
      mode="success-only-when-full"
      valueLabel="82 of 120 GB"
      warningLabel="Over limit"
      successLabel="At capacity"
      format={{ style: "percent" }}
    />
  );

  // @ts-expect-error locale is provider-only
  const _noLocale = <Meter value={10} locale="nb-NO" />;
  // @ts-expect-error no size axis
  const _noSize = <Meter value={10} size="md" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Meter value={10} as="div" />;
  // @ts-expect-error primitive min is minValue on the composite
  const _noMin = <Meter value={10} min={0} />;
  // @ts-expect-error primitive max is maxValue on the composite
  const _noMax = <Meter value={10} max={100} />;
});
