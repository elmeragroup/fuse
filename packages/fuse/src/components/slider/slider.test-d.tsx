import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import { Slider } from "@elmeragroup/fuse/slider";
import type { SliderProps } from "@elmeragroup/fuse/slider";

test("SliderProps is the closed labeled-composite face", () => {
  expectTypeOf<SliderProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SliderProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SliderProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<SliderProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SliderProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SliderProps["minValue"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<SliderProps["maxValue"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<SliderProps["step"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<SliderProps["largeStep"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<SliderProps["orientation"]>().toEqualTypeOf<"horizontal" | "vertical" | undefined>();
  expectTypeOf<SliderProps["formatOptions"]>().toEqualTypeOf<Intl.NumberFormatOptions | undefined>();
  expectTypeOf<SliderProps["showValue"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SliderProps["thumbLabels"]>().toEqualTypeOf<readonly string[] | undefined>();
  expectTypeOf<SliderProps>().toHaveProperty("name");
  expectTypeOf<SliderProps>().toHaveProperty("className");
  expectTypeOf<SliderProps>().toHaveProperty("aria-label");
  expectTypeOf<SliderProps>().not.toHaveProperty("min");
  expectTypeOf<SliderProps>().not.toHaveProperty("max");
  expectTypeOf<SliderProps>().not.toHaveProperty("disabled");
  expectTypeOf<SliderProps>().not.toHaveProperty("format");
  expectTypeOf<SliderProps>().not.toHaveProperty("locale");
  expectTypeOf<SliderProps>().not.toHaveProperty("onValueChange");
});

test("a single value reports a number", () => {
  expectTypeOf<SliderProps["value"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<SliderProps["onChange"]>().toEqualTypeOf<((value: number) => void) | undefined>();

  <Slider
    defaultValue={40}
    onChange={(value) => {
      expectTypeOf(value).toEqualTypeOf<number>();
    }}
  />;
  <Slider
    onChange={(value) => {
      expectTypeOf(value).toEqualTypeOf<number>();
    }}
  />;
});

test("a range reports an array of the same shape", () => {
  expectTypeOf<SliderProps<[number, number]>["onChange"]>().toEqualTypeOf<
    ((value: [number, number]) => void) | undefined
  >();

  <Slider
    defaultValue={[20, 80]}
    onChange={(value) => {
      expectTypeOf(value).toEqualTypeOf<[number, number]>();
    }}
  />;
  <Slider
    defaultValue={[10, 50, 90]}
    onChange={(value) => {
      expectTypeOf(value).toEqualTypeOf<[number, number, number]>();
    }}
  />;
});

test("a range takes at least two numbers, since base-ui treats one as a single value", () => {
  // @ts-expect-error a one-number array is not a range
  <Slider defaultValue={[50]} />;
  // @ts-expect-error a one-number array is not a range
  <Slider value={[50] as const} />;
  const unsized: number[] = [50];
  // @ts-expect-error an unsized array may hold one number
  <Slider defaultValue={unsized} />;
});

test("a literal range reports numbers of the same length, since interaction moves them", () => {
  expectTypeOf<SliderProps<readonly [20, 80]>["onChange"]>().toEqualTypeOf<
    ((value: readonly [number, number]) => void) | undefined
  >();

  <Slider
    defaultValue={[20, 80] as const}
    onChange={(value) => {
      expectTypeOf(value).toEqualTypeOf<readonly [number, number]>();
    }}
  />;
});

test("onChange cannot disagree with the value shape", () => {
  // @ts-expect-error a single-value slider never reports an array
  <Slider value={40} onChange={(value: number[]) => value} />;
  // @ts-expect-error a range never reports a single number
  <Slider value={[20, 80]} onChange={(value: number) => value} />;
  // @ts-expect-error the value is a number or an array of numbers
  <Slider value="40" />;
});
