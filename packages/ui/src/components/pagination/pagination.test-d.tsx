import { expectTypeOf, test } from "vitest";

import type { Pagination as RootPagination } from "@elmeragroup/ui";
import * as PaginationModule from "@elmeragroup/ui/pagination";
import { Pagination, paginationVariants } from "@elmeragroup/ui/pagination";

test("Pagination and paginationVariants ship from the pagination entry and the root barrel", () => {
  expectTypeOf<typeof Pagination>().toEqualTypeOf<typeof RootPagination>();
  expectTypeOf(Pagination.Root).toBeFunction();
  expectTypeOf(Pagination.Content).toBeFunction();
  expectTypeOf(Pagination.Item).toBeFunction();
  expectTypeOf(Pagination.Link).toBeFunction();
  expectTypeOf(Pagination.Previous).toBeFunction();
  expectTypeOf(Pagination.Next).toBeFunction();
  expectTypeOf(Pagination.Ellipsis).toBeFunction();
  expectTypeOf(paginationVariants).toBeFunction();
});

test("the public namespace is seven parts plus the public recipe — never the flat ref names", () => {
  expectTypeOf(Pagination).not.toHaveProperty("PaginationContent");
  expectTypeOf(Pagination).not.toHaveProperty("PaginationItem");
  expectTypeOf(Pagination).not.toHaveProperty("PaginationLink");
  expectTypeOf(Pagination).not.toHaveProperty("PaginationPrevious");
  expectTypeOf(Pagination).not.toHaveProperty("PaginationNext");
  expectTypeOf(Pagination).not.toHaveProperty("PaginationEllipsis");
  expectTypeOf(PaginationModule).not.toHaveProperty("PaginationLink");
  expectTypeOf(PaginationModule).not.toHaveProperty("PaginationPrevious");
  expectTypeOf(PaginationModule).not.toHaveProperty("PaginationNext");
  expectTypeOf(PaginationModule).not.toHaveProperty("PaginationEllipsis");
});

test("parts take the public API: no locale, no consumer direction, no as prop", () => {
  expectTypeOf<Parameters<typeof Pagination.Root>[0]["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Parameters<typeof Pagination.Link>[0]["isActive"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<Parameters<typeof Pagination.Link>[0]["size"]>().toEqualTypeOf<
    "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-inline" | "icon-lg" | undefined
  >();
  expectTypeOf<Parameters<typeof Pagination.Previous>[0]["text"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Parameters<typeof Pagination.Previous>[0]["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Parameters<typeof Pagination.Next>[0]["text"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Parameters<typeof Pagination.Ellipsis>[0]["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Parameters<typeof Pagination.Root>[0]>().not.toHaveProperty("locale");
  expectTypeOf<Parameters<typeof Pagination.Root>[0]>().not.toHaveProperty("direction");
  expectTypeOf<Parameters<typeof Pagination.Link>[0]>().not.toHaveProperty("direction");
  expectTypeOf<Parameters<typeof Pagination.Previous>[0]>().not.toHaveProperty("direction");
  expectTypeOf<Parameters<typeof Pagination.Next>[0]>().not.toHaveProperty("direction");
  expectTypeOf<Parameters<typeof Pagination.Root>[0]>().not.toHaveProperty("as");

  const _tree = (
    <Pagination.Root>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous href="#" />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#" isActive>
            1
          </Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#" size="icon">
            2
          </Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Ellipsis />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next href="#" text="Forward" label="Skip ahead" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination.Root>
  );

  const _overrides = (
    <Pagination.Root label="Pages" aria-label="Invoice pages" ref={null}>
      <Pagination.Content>
        <Pagination.Previous href="#prev" aria-label="Earlier" />
        <Pagination.Ellipsis label="Hidden pages" />
      </Pagination.Content>
    </Pagination.Root>
  );

  expectTypeOf<Parameters<typeof Pagination.Previous>[0]>().not.toHaveProperty("isActive");
  expectTypeOf<Parameters<typeof Pagination.Previous>[0]>().not.toHaveProperty("children");
  expectTypeOf<Parameters<typeof Pagination.Next>[0]>().not.toHaveProperty("isActive");
  expectTypeOf<Parameters<typeof Pagination.Next>[0]>().not.toHaveProperty("children");
  expectTypeOf<Parameters<typeof Pagination.Ellipsis>[0]>().not.toHaveProperty("children");

  // @ts-expect-error locale is provider-only
  const _noLocale = <Pagination.Root locale="nb-NO" />;
  // @ts-expect-error direction is not a consumer-facing prop
  const _noDirection = <Pagination.Previous href="#" direction="previous" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Pagination.Link as="button" />;
  // @ts-expect-error Previous is not a current-page control
  const _prevActive = <Pagination.Previous href="#" isActive />;
  // @ts-expect-error Previous owns its children
  const _prevChildren = <Pagination.Previous href="#">nope</Pagination.Previous>;
  // @ts-expect-error Next is not a current-page control
  const _nextActive = <Pagination.Next href="#" isActive />;
  // @ts-expect-error Next owns its children
  const _nextChildren = <Pagination.Next href="#">nope</Pagination.Next>;
  // @ts-expect-error Ellipsis owns its children
  const _ellipsisChildren = <Pagination.Ellipsis>nope</Pagination.Ellipsis>;
});

test("paginationVariants is public and returns slotted class builders", () => {
  expectTypeOf(paginationVariants().base()).toBeString();
  expectTypeOf(paginationVariants({ direction: "previous" }).link()).toBeString();
  expectTypeOf(paginationVariants({ direction: "next" }).link()).toBeString();
});
