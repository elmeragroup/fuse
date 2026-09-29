import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { MeterProps } from "@elmeragroup/fuse/meter";
import { METER_CONSTANTS } from "@elmeragroup/fuse/meter";

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
