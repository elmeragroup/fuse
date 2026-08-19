import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { BrandLogoProps, ElmeraIconProps } from "../icons";
import type * as Icons from "../icons";
import type * as Root from "../index";
import type { BrandCode } from "../theme";

test("public adapters accept regular and fill and reject other weights", () => {
  expectTypeOf<ElmeraIconProps["weight"]>().toEqualTypeOf<"regular" | "fill" | undefined>();
  expectTypeOf<ComponentProps<(typeof Icons)["Check"]>["weight"]>().toEqualTypeOf<
    "regular" | "fill" | undefined
  >();
  expectTypeOf<ComponentProps<(typeof Icons)["Check"]>>().toEqualTypeOf<
    ComponentProps<(typeof Icons)["X"]>
  >();

  const _regular: ElmeraIconProps = { weight: "regular" };
  const _fill: ElmeraIconProps = { weight: "fill" };
  const _default: ElmeraIconProps = {};

  // @ts-expect-error thin is not a public icon weight
  const _thin: ElmeraIconProps = { weight: "thin" };
  // @ts-expect-error light is not a public icon weight
  const _light: ElmeraIconProps = { weight: "light" };
  // @ts-expect-error bold is not a public icon weight
  const _bold: ElmeraIconProps = { weight: "bold" };
  // @ts-expect-error duotone is not a public icon weight
  const _duotone: ElmeraIconProps = { weight: "duotone" };
});

test("there is no Icon namespace on /icons or the root barrel", () => {
  expectTypeOf<typeof Icons>().not.toHaveProperty("Icon");
  expectTypeOf<typeof Root>().not.toHaveProperty("Icon");
  expectTypeOf<typeof Root>().not.toHaveProperty("Check");
});

test("BrandLogo accepts every brand code including elma", () => {
  expectTypeOf<BrandLogoProps["brand"]>().toEqualTypeOf<BrandCode>();
  expectTypeOf<BrandLogoProps["variant"]>().toEqualTypeOf<"full" | "mark" | undefined>();

  const _elma: BrandLogoProps = { brand: "elma", variant: "mark" };
  const _full: BrandLogoProps = { brand: "elma", variant: "full" };

  // @ts-expect-error steddi is outside this theme set
  const _steddi: BrandLogoProps = { brand: "steddi" };
});
