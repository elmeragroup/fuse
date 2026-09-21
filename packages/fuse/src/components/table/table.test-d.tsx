import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Table as RootTable, VerticalTable as RootVerticalTable } from "@elmeragroup/fuse";
import type {
  TableRootProps,
  VerticalTableBodyProps,
  VerticalTableHeaderProps,
  VerticalTableItem,
  VerticalTableKeyProps,
  VerticalTableRootProps,
} from "@elmeragroup/fuse/table";
import * as TableModule from "@elmeragroup/fuse/table";
import { Table, VerticalTable } from "@elmeragroup/fuse/table";

test("both namespaces ship from the table entry and the root barrel", () => {
  expectTypeOf<typeof Table>().toEqualTypeOf<typeof RootTable>();
  expectTypeOf<typeof VerticalTable>().toEqualTypeOf<typeof RootVerticalTable>();
  expectTypeOf(Table).toHaveProperty("Root");
  expectTypeOf(Table).toHaveProperty("Header");
  expectTypeOf(Table).toHaveProperty("Body");
  expectTypeOf(Table).toHaveProperty("Footer");
  expectTypeOf(Table).toHaveProperty("Row");
  expectTypeOf(Table).toHaveProperty("Head");
  expectTypeOf(Table).toHaveProperty("Cell");
  expectTypeOf(Table).toHaveProperty("Caption");
  expectTypeOf(VerticalTable).toHaveProperty("Root");
  expectTypeOf(VerticalTable).toHaveProperty("Header");
  expectTypeOf(VerticalTable).toHaveProperty("Body");
  expectTypeOf(VerticalTable).toHaveProperty("Row");
  expectTypeOf(VerticalTable).toHaveProperty("Key");
  expectTypeOf(VerticalTable).toHaveProperty("Value");
});

test("public API exports the namespaces and VerticalTableItem — never RAC or flat ref names", () => {
  expectTypeOf<TableRootProps>().toEqualTypeOf<ComponentProps<"table">>();
  expectTypeOf<VerticalTableRootProps["variant"]>().toEqualTypeOf<
    "default" | "non-bordered-compact" | undefined
  >();
  expectTypeOf<VerticalTableHeaderProps>().toHaveProperty("render");
  expectTypeOf<VerticalTableKeyProps>().toHaveProperty("render");
  expectTypeOf<VerticalTableBodyProps["data"]>().toEqualTypeOf<VerticalTableItem[] | undefined>();
  expectTypeOf<VerticalTableBodyProps["tableProps"]>().toEqualTypeOf<TableRootProps | undefined>();
  expectTypeOf<VerticalTableItem>().toHaveProperty("label");
  expectTypeOf<VerticalTableItem>().toHaveProperty("value");
  expectTypeOf<VerticalTableItem["fontWeight"]>().toEqualTypeOf<"normal" | "bold" | undefined>();
  expectTypeOf<VerticalTableItem["isLoading"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<VerticalTableItem["text"]>().toEqualTypeOf<"default" | "truncate" | undefined>();

  expectTypeOf(TableModule).not.toHaveProperty("tableVariants");
  expectTypeOf(TableModule).not.toHaveProperty("TableHeader");
  expectTypeOf(TableModule).not.toHaveProperty("TableBody");
  expectTypeOf(TableModule).not.toHaveProperty("TableCell");
  expectTypeOf(TableModule).not.toHaveProperty("TableVerticalBodyItem");
  expectTypeOf(TableModule).not.toHaveProperty("VerticalTableHeader");
  expectTypeOf(TableModule).not.toHaveProperty("VerticalTableKey");
  expectTypeOf(TableModule).not.toHaveProperty("Heading");
  expectTypeOf(Table).not.toHaveProperty("as");
  expectTypeOf(VerticalTable).not.toHaveProperty("as");
});

test("parts take native attributes, Header render, and no polymorphic as prop", () => {
  const items: VerticalTableItem[] = [
    { label: "Name", value: "Kari Nordmann" },
    { label: "Meter", value: "7070575000", isLoading: true, text: "default", fontWeight: "bold" },
  ];

  const _tree = (
    <Table.Root className="min-w-xl" id="orders">
      <Table.Caption>Recent orders</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head>Order</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row data-state="selected">
          <Table.Cell>#1042</Table.Cell>
        </Table.Row>
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell>1 row</Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Root>
  );

  const _vertical = (
    <VerticalTable.Root variant="non-bordered-compact">
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Header render={<h3 />}>Section</VerticalTable.Header>
      <VerticalTable.Body data={items} aria-labelledby="customer">
        <VerticalTable.Row fontWeight="bold" isHidden>
          <VerticalTable.Key text="default" isLoading>
            Hidden
          </VerticalTable.Key>
          <VerticalTable.Value text="truncate">Secret</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
      <VerticalTable.Body tableProps={{ "aria-labelledby": "customer" }}>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Name</VerticalTable.Key>
          <VerticalTable.Value>Kari Nordmann</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    </VerticalTable.Root>
  );

  const _ref = <Table.Root ref={null} />;

  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Table.Root as="section" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noVerticalAs = <VerticalTable.Root as="section" />;
  // @ts-expect-error stacked is not a vertical-table variant
  const _badVariant = <VerticalTable.Root variant="stacked" />;
});
