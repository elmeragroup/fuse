import { expectTypeOf, test } from "vitest";

import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";

test("parts take the public API: no locale, no as prop", () => {
  expectTypeOf<Parameters<typeof Breadcrumb.Root>[0]["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Parameters<typeof Breadcrumb.Ellipsis>[0]["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Parameters<typeof Breadcrumb.Link>[0]["render"]>().not.toEqualTypeOf<undefined>();
  expectTypeOf<Parameters<typeof Breadcrumb.Root>[0]>().not.toHaveProperty("locale");
  expectTypeOf<Parameters<typeof Breadcrumb.Link>[0]>().not.toHaveProperty("as");
  expectTypeOf<Parameters<typeof Breadcrumb.Root>[0]>().not.toHaveProperty("as");

  const _tree = (
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/orders" render={<a href="/orders" />}>
            Orders
          </Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator>/</Breadcrumb.Separator>
        <Breadcrumb.Item>
          <Breadcrumb.Ellipsis />
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Breadcrumb.Page>Invoice</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  );

  const _overrides = (
    <Breadcrumb.Root label="Trail" aria-label="Invoice trail" ref={null}>
      <Breadcrumb.List>
        <Breadcrumb.Ellipsis label="Hidden crumbs" />
      </Breadcrumb.List>
    </Breadcrumb.Root>
  );

  expectTypeOf<Parameters<typeof Breadcrumb.Ellipsis>[0]>().not.toHaveProperty("children");
  expectTypeOf<Parameters<typeof Breadcrumb.Separator>[0]>().toHaveProperty("children");

  // @ts-expect-error locale is provider-only
  const _noLocale = <Breadcrumb.Root locale="nb-NO" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Breadcrumb.Link as="button" />;
  // @ts-expect-error Ellipsis owns its children
  const _ellipsisChildren = <Breadcrumb.Ellipsis>nope</Breadcrumb.Ellipsis>;
});
