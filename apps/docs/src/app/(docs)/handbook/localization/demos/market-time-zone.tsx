"use client";

import { tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";
import { LocaleProvider } from "@elmeragroup/fuse/theme";

type SpotPrice = { readonly starts: Date; readonly price: number };

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({}),
});

const columns = createAppColumnHelper<SpotPrice>();

const COLUMNS = columns.columns([
  columns.accessor("starts", { header: "Starter", cell: ({ cell }) => <cell.DateTimeCell /> }),
  columns.accessor("price", {
    header: "kr/kWh eks. mva",
    cell: ({ cell }) => <cell.NumberCell minimumFractionDigits={3} maximumFractionDigits={3} />,
  }),
]);

// NO1 day-ahead prices from hvakosterstrommen.no for the first hours of 26 October 2025, when
// Norway left summer time and 02:00 came twice. The rows hold UTC instants and no zone.
const PRICES: SpotPrice[] = [
  { starts: new Date("2025-10-25T22:00:00Z"), price: 0.09423 },
  { starts: new Date("2025-10-25T23:00:00Z"), price: 0.04833 },
  { starts: new Date("2025-10-26T00:00:00Z"), price: 0.04032 },
  { starts: new Date("2025-10-26T01:00:00Z"), price: 0.03695 },
  { starts: new Date("2025-10-26T02:00:00Z"), price: 0.05379 },
];

function SpotPrices() {
  const table = useFuseTable({ columns: COLUMNS, data: PRICES });
  return (
    <table.AppTable>
      <table.Content aria-label="Spotpriser NO1" />
    </table.AppTable>
  );
}

export function MarketTimeZone() {
  // The zone of the prices' market, not the viewer's, so the server and every browser write the
  // same Oslo hours.
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <SpotPrices />
    </LocaleProvider>
  );
}
