"use client";

import { createContext, useState } from "react";
import type { ComponentProps, ReactElement } from "react";

import { definedProps } from "../../internal/defined-props";
import { Table } from "../table/table";

/**
 * Names the header cell around a handle. It is package-private. A header cell's accessible name
 * comes from its content, and a focusable separator inside it joins that name with its value, as
 * "Subject 160 pixels" in Chromium. `SizedHead` provides it, and the handle passes its
 * `columnName` once it has mounted, so the cell keeps its own name.
 */
export const HeadNameContext = createContext<((name: string | undefined) => void) | undefined>(undefined);

/**
 * A header cell of a sized table. It is package-private. A `DataTable.ResizeHandle` inside it
 * names it after the column, through `HeadNameContext`.
 */
export function SizedHead({ children, ...props }: ComponentProps<"th">): ReactElement {
  const [name, setName] = useState<string | undefined>(undefined);
  return (
    <Table.Head {...definedProps({ "aria-label": name })} {...props}>
      <HeadNameContext.Provider value={setName}>{children}</HeadNameContext.Provider>
    </Table.Head>
  );
}
