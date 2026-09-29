import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as LinkApi from "@elmeragroup/fuse/react-aria/link";
import { Link } from "@elmeragroup/fuse/react-aria/link";

test("linkVariants and RAC types are not public exports", () => {
  expectTypeOf<typeof LinkApi>().not.toHaveProperty("linkVariants");
  // @ts-expect-error the module-private recipe is not a public type either
  type _NoRecipe = LinkApi.linkVariants;
  // @ts-expect-error RAC render props are not re-exported from this entry
  type _NoRenderProps = LinkApi.LinkRenderProps;
  // @ts-expect-error RAC's LinkContext is not a public export
  type _NoContext = LinkApi.LinkContext;
  // @ts-expect-error react-aria's link options are not leaked
  type _NoAriaOptions = LinkApi.AriaLinkOptions;
  // @ts-expect-error the RAC props interface is not leaked under a bare RAC name
  type _NoAriaProps = LinkApi.AriaLinkProps;
});

test("the element takes the public props, forwards a ref, and rejects a size axis", () => {
  const _anchor = (
    <Link
      href="/orders/1042"
      target="_blank"
      rel="noreferrer"
      hrefLang="nb"
      routerOptions={undefined}
      variant="error"
      weight="bold"
      leading="tight"
      align="center"
      truncate
      aria-current="page"
      className="underline">
      Invoice 1042
    </Link>
  );
  const _span = (
    <Link isDisabled onPress={() => undefined} aria-label="Open the invoice">
      Invoice 1042
    </Link>
  );
  const _ref = (
    <Link
      ref={(node: HTMLAnchorElement | null) => {
        node?.blur();
      }}
      href="/orders"
    />
  );
  const _refObject: Ref<HTMLAnchorElement> = null;
  const _refProp = <Link ref={_refObject} href="/orders" />;

  // @ts-expect-error a text atom has no control-box size axis
  const _noSize = <Link size="md" href="/orders" />;
  // @ts-expect-error the reference's status value name is renamed to `error`
  const _noDestructive = <Link variant="destructive" href="/orders" />;
  // @ts-expect-error `medium` is Text's weight value, not Link's two-value axis
  const _noMediumWeight = <Link weight="medium" href="/orders" />;
});
