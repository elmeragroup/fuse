import { expectTypeOf, test } from "vitest";

import type { Breadcrumb as RootBreadcrumb } from "@elmeragroup/ui";
import * as BreadcrumbModule from "@elmeragroup/ui/breadcrumb";
import { Breadcrumb } from "@elmeragroup/ui/breadcrumb";

test("Breadcrumb ships from the breadcrumb entry and the root barrel", () => {
  expectTypeOf<typeof Breadcrumb>().toEqualTypeOf<typeof RootBreadcrumb>();
  expectTypeOf(Breadcrumb.Root).toBeFunction();
  expectTypeOf(Breadcrumb.List).toBeFunction();
  expectTypeOf(Breadcrumb.Item).toBeFunction();
  expectTypeOf(Breadcrumb.Link).toBeFunction();
  expectTypeOf(Breadcrumb.Page).toBeFunction();
  expectTypeOf(Breadcrumb.Separator).toBeFunction();
  expectTypeOf(Breadcrumb.Ellipsis).toBeFunction();
});

test("the public namespace is seven parts — never the flat ref names or a recipe", () => {
  expectTypeOf(Breadcrumb).not.toHaveProperty("BreadcrumbList");
  expectTypeOf(Breadcrumb).not.toHaveProperty("BreadcrumbItem");
  expectTypeOf(Breadcrumb).not.toHaveProperty("BreadcrumbLink");
  expectTypeOf(Breadcrumb).not.toHaveProperty("BreadcrumbPage");
  expectTypeOf(Breadcrumb).not.toHaveProperty("BreadcrumbSeparator");
  expectTypeOf(Breadcrumb).not.toHaveProperty("BreadcrumbEllipsis");
  expectTypeOf(BreadcrumbModule).not.toHaveProperty("BreadcrumbList");
  expectTypeOf(BreadcrumbModule).not.toHaveProperty("BreadcrumbLink");
  expectTypeOf(BreadcrumbModule).not.toHaveProperty("breadcrumbVariants");
});

test("parts take the spec surface: no locale, no as prop", () => {
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

  // @ts-expect-error locale is provider-only
  const _noLocale = <Breadcrumb.Root locale="nb-NO" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Breadcrumb.Link as="button" />;
});
