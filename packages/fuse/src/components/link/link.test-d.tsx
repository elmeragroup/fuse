import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as LinkApi from "@elmeragroup/fuse/link";
import { Link, linkVariants } from "@elmeragroup/fuse/link";

test("the entry exports the component, its props and the public recipe", () => {
  expectTypeOf<typeof LinkApi>().toHaveProperty("Link");
  expectTypeOf<typeof LinkApi>().toHaveProperty("linkVariants");
  expectTypeOf(linkVariants({ variant: "error", underline: "hover" })).toEqualTypeOf<string>();
});

test("the element takes anchor props, the axes and a render element, and forwards a ref", () => {
  const _anchor = (
    <Link
      href="/orders/1042"
      target="_blank"
      rel="noreferrer"
      hrefLang="nb"
      variant="error"
      underline="none"
      weight="bold"
      truncate
      aria-current="page"
      className="underline">
      Invoice 1042
    </Link>
  );
  const _rendered = <Link render={<a href="/orders" />}>Orders</Link>;
  const _refObject: Ref<HTMLAnchorElement> = null;
  const _refProp = <Link ref={_refObject} href="/orders" />;
});

test("the axes reject values Link does not draw", () => {
  // @ts-expect-error a text link has no control-box size axis
  const _noSize = <Link size="md" href="/orders" />;
  // @ts-expect-error Text's status name is `error` on Link
  const _noDestructive = <Link variant="destructive" href="/orders" />;
  // @ts-expect-error `secondary` is Text's deprecated alias, which Link leaves out
  const _noSecondary = <Link variant="secondary" href="/orders" />;
  // @ts-expect-error the underline axis has no `dotted` value
  const _noDotted = <Link underline="dotted" href="/orders" />;
  // @ts-expect-error Link sits in its sentence's line height, so it has no leading axis
  const _noLeading = <Link leading="tight" href="/orders" />;
  // @ts-expect-error React Aria's disabled prop is not part of a native anchor
  const _noIsDisabled = <Link isDisabled href="/orders" />;
});
