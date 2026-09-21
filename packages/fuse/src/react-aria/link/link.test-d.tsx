import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/fuse";
import type * as LinkApi from "@elmeragroup/fuse/react-aria/link";
import type { LinkProps } from "@elmeragroup/fuse/react-aria/link";
import { Link } from "@elmeragroup/fuse/react-aria/link";

test("Link is absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("Link");
});

test("the public value surface is exactly Link", () => {
  expectTypeOf(Link).toBeFunction();
  expectTypeOf<typeof LinkApi.Link>().toEqualTypeOf<typeof Link>();
});

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

test("LinkProps carries the five typography axes and no size axis", () => {
  expectTypeOf<LinkProps["variant"]>().toEqualTypeOf<
    "default" | "foreground" | "primary" | "secondary" | "brand" | "muted" | "inherit" | "error" | undefined
  >();
  expectTypeOf<LinkProps["leading"]>().toEqualTypeOf<
    "none" | "tight" | "snug" | "relaxed" | "loose" | undefined
  >();
  expectTypeOf<LinkProps["truncate"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<LinkProps["align"]>().toEqualTypeOf<"left" | "center" | "right" | "justify" | undefined>();
  expectTypeOf<LinkProps["weight"]>().toEqualTypeOf<"normal" | "bold" | undefined>();
  expectTypeOf<LinkProps>().not.toHaveProperty("size");
});

test("LinkProps forwards the RAC link surface", () => {
  expectTypeOf<LinkProps>().toHaveProperty("href");
  expectTypeOf<LinkProps>().toHaveProperty("target");
  expectTypeOf<LinkProps>().toHaveProperty("rel");
  expectTypeOf<LinkProps>().toHaveProperty("download");
  expectTypeOf<LinkProps>().toHaveProperty("ping");
  expectTypeOf<LinkProps>().toHaveProperty("referrerPolicy");
  expectTypeOf<LinkProps>().toHaveProperty("hrefLang");
  expectTypeOf<LinkProps>().toHaveProperty("routerOptions");
  expectTypeOf<LinkProps>().toHaveProperty("isDisabled");
  expectTypeOf<LinkProps>().toHaveProperty("onPress");
  expectTypeOf<LinkProps>().toHaveProperty("onPressStart");
  expectTypeOf<LinkProps>().toHaveProperty("onPressEnd");
  expectTypeOf<LinkProps>().toHaveProperty("onHoverStart");
  expectTypeOf<LinkProps>().toHaveProperty("onHoverEnd");
  expectTypeOf<LinkProps>().toHaveProperty("onHoverChange");
  expectTypeOf<LinkProps>().toHaveProperty("onFocus");
  expectTypeOf<LinkProps>().toHaveProperty("onBlur");
  expectTypeOf<LinkProps>().toHaveProperty("onFocusChange");
  expectTypeOf<LinkProps>().toHaveProperty("onKeyDown");
  expectTypeOf<LinkProps>().toHaveProperty("onKeyUp");
  expectTypeOf<LinkProps>().toHaveProperty("autoFocus");
  expectTypeOf<LinkProps>().toHaveProperty("aria-label");
  // `aria-current` is a runtime pass-through RAC reads off `props` without declaring it
  // (it drives `data-current`, asserted in the browser suite). Its JSX acceptance is
  // covered below; there is no key to assert here.
  expectTypeOf<LinkProps>().toHaveProperty("children");
  expectTypeOf<LinkProps>().toHaveProperty("className");
  expectTypeOf<LinkProps["href"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<LinkProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
});

test("className takes a plain string", () => {
  const _string: LinkProps = { className: "underline" };
  const _badClassName: LinkProps = {
    // @ts-expect-error className is a class list, never a number
    className: 4,
  };
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

test("there is no bare link entry", () => {
  // @ts-expect-error quarantined path only — never a bare link entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/fuse/link");
});
