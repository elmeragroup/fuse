"use client";

import { tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";

type Reading = {
  readonly meter: string;
  readonly kwh: number;
  readonly cost: number;
  readonly day: Date;
  readonly readAt: Date;
};

const READINGS: Reading[] = [
  {
    meter: "7070575000",
    kwh: 412.6,
    cost: 1384.2,
    day: new Date(Date.UTC(2026, 9, 1)),
    readAt: new Date(Date.UTC(2026, 9, 1, 6, 30)),
  },
  {
    meter: "7070575001",
    kwh: 1288.05,
    cost: 3920.75,
    day: new Date(Date.UTC(2026, 9, 2)),
    readAt: new Date(Date.UTC(2026, 9, 2, 7, 15)),
  },
];

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({}),
  getRowId: (reading: Reading) => reading.meter,
});

const columns = createAppColumnHelper<Reading>();

// Each default cell formats for the LocaleProvider's locale; the dates name their zone.
const COLUMNS = columns.columns([
  columns.accessor("meter", { header: "Meter", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("kwh", {
    header: "kWh",
    cell: ({ cell }) => <cell.NumberCell maximumFractionDigits={1} />,
  }),
  columns.accessor("cost", { header: "Cost", cell: ({ cell }) => <cell.CurrencyCell currency="NOK" /> }),
  columns.accessor("day", { header: "Day", cell: ({ cell }) => <cell.DateCell timeZone="Europe/Oslo" /> }),
  columns.accessor("readAt", {
    header: "Read at",
    cell: ({ cell }) => <cell.DateTimeCell timeZone="Europe/Oslo" />,
  }),
]);

export function DataTableFormattedCells() {
  const table = useFuseTable({ columns: COLUMNS, data: READINGS });
  return (
    <table.AppTable>
      <table.Content aria-label="Meter readings" />
    </table.AppTable>
  );
}
