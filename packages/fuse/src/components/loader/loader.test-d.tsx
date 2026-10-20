import { expectTypeOf, test } from "vitest";

import type { LoaderProps } from "@elmeragroup/fuse/loader";
import { Loader } from "@elmeragroup/fuse/loader";

test("LoaderProps is native div props plus the recipe axes, and the element takes them with no polymorphic as prop", () => {
  expectTypeOf<LoaderProps["variant"]>().toEqualTypeOf<"default" | undefined>();
  expectTypeOf<LoaderProps["size"]>().toEqualTypeOf<
    "default" | "small" | "medium" | "large" | "xl" | undefined
  >();
  expectTypeOf<LoaderProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<LoaderProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<LoaderProps["label"]>().toEqualTypeOf<string | undefined>();

  const _basic = <Loader />;
  const _named = <Loader size="medium" variant="default" aria-label="Laster" className="p-0" />;
  const _labelled = <Loader label="Henter ordrer" />;
  // @ts-expect-error the announced label is text, not a node
  const _nodeLabel = <Loader label={<b>Henter</b>} />;

  // @ts-expect-error the variant axis is intentionally single-valued
  const _badVariant = <Loader variant="muted" />;
  // @ts-expect-error decorative sizes are default | small | medium | large | xl
  const _badSize = <Loader size="md" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Loader as="span" />;
});
