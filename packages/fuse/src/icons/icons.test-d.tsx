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
  expectTypeOf<ComponentProps<(typeof Icons)["SlidersHorizontal"]>>().toEqualTypeOf<ElmeraIconProps>();

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

test("public adapters are named by title, not Phosphor's alt", () => {
  expectTypeOf<ElmeraIconProps["title"]>().toEqualTypeOf<string | undefined>();
  // @ts-expect-error alt is not a public icon prop; use title
  const _alt: ElmeraIconProps = { alt: "Done" };
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

test("BrandLogo public props are the fallback host, not SVG", () => {
  expectTypeOf<BrandLogoProps>().toHaveProperty("id");
  expectTypeOf<BrandLogoProps>().toHaveProperty("className");
  expectTypeOf<BrandLogoProps>().toHaveProperty("style");
  expectTypeOf<BrandLogoProps>().toHaveProperty("lang");
  expectTypeOf<BrandLogoProps>().toHaveProperty("hidden");
  expectTypeOf<BrandLogoProps>().toHaveProperty("title");
  expectTypeOf<BrandLogoProps>().not.toHaveProperty("viewBox");
  expectTypeOf<BrandLogoProps>().not.toHaveProperty("xmlns");
  expectTypeOf<BrandLogoProps>().not.toHaveProperty("preserveAspectRatio");
  expectTypeOf<BrandLogoProps>().not.toHaveProperty("children");

  const _host: BrandLogoProps = {
    brand: "elma",
    id: "brand-logo",
    className: "logo",
    lang: "nb",
    hidden: true,
    style: { color: "red" },
    title: "Elmera Group",
  };

  const _viewBox: BrandLogoProps = {
    brand: "elma",
    // @ts-expect-error viewBox is not a fallback-host prop
    viewBox: "0 0 24 24",
  };
  const _xmlns: BrandLogoProps = {
    brand: "elma",
    // @ts-expect-error xmlns is not a fallback-host prop
    xmlns: "http://www.w3.org/2000/svg",
  };
  void _host;
  void _viewBox;
  void _xmlns;
});
