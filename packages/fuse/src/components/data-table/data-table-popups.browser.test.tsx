import type { ReactElement } from "react";

/**
 * Browser project. A controlled column toggle and rows-per-page list: the owner's `open` decides
 * whether each popup shows, and a trigger press only reports the request.
 */
import { useTable } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  features,
  ORDERS_25,
  ORDERS_3,
  plainColumns,
  registeredColumns,
  renderInEnglish,
  useFuseTable,
} from "../../../test/data-table-fixtures";
import { roleNamed } from "../../../test/themed-browser-render";
import { DataTable } from "./index";

describe("DataTable controlled popups", () => {
  type OpenChange = { readonly open: boolean; readonly reason: string };

  function ControlledToggleTable({
    open,
    onChange,
  }: {
    readonly open: boolean;
    readonly onChange: (change: OpenChange) => void;
  }): ReactElement {
    const table = useFuseTable({ columns: registeredColumns, data: ORDERS_3 });
    return (
      <table.AppTable>
        <table.ColumnToggle
          open={open}
          onOpenChange={(next, details) => {
            onChange({ open: next, reason: details.reason });
          }}
        />
        <table.Content />
      </table.AppTable>
    );
  }

  function ControlledPageSizeTable({
    open,
    onChange,
  }: {
    readonly open: boolean;
    readonly onChange: (change: OpenChange) => void;
  }): ReactElement {
    const table = useTable({
      features,
      columns: plainColumns,
      data: ORDERS_25,
      initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    });
    return (
      <DataTable.Pagination
        table={table}
        pageSizeOpen={open}
        onPageSizeOpenChange={(next, details) => {
          onChange({ open: next, reason: details.reason });
        }}
      />
    );
  }

  // Oracle: a controlled popup shows exactly when its owner's `open` is true, and a press on
  // the trigger only asks the owner, through the change callback with Base UI's reason.
  it("opens and closes table.ColumnToggle's menu from open, and reports a trigger press", async () => {
    const changes: OpenChange[] = [];
    const record = (change: OpenChange) => {
      changes.push(change);
    };
    const { rerender } = renderInEnglish(<ControlledToggleTable open onChange={record} />);
    await expect.element(page.getByRole("menu")).toBeInTheDocument();

    rerender(<ControlledToggleTable open={false} onChange={record} />);
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(roleNamed("button", "Columns"));
    expect(changes).toEqual([{ open: true, reason: "trigger-press" }]);
    expect(page.getByRole("menu").query()).toBeNull();
  });

  it("opens and closes the rows-per-page list from pageSizeOpen, and reports a trigger press", async () => {
    const changes: OpenChange[] = [];
    const record = (change: OpenChange) => {
      changes.push(change);
    };
    const { rerender } = renderInEnglish(<ControlledPageSizeTable open onChange={record} />);
    await expect.element(page.getByRole("listbox")).toBeInTheDocument();

    rerender(<ControlledPageSizeTable open={false} onChange={record} />);
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument();

    await userEvent.click(roleNamed("combobox", "Rows per page"));
    expect(changes).toEqual([{ open: true, reason: "trigger-press" }]);
    expect(page.getByRole("listbox").query()).toBeNull();
  });
});
