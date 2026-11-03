import { Sparkline } from "@elmeragroup/fuse/chart";
import { Table } from "@elmeragroup/fuse/table";

const AREAS = [
  { area: "NO1", today: [61.2, 58.4, 55.9, 54.1, 57.3, 72.8, 104.5, 131.9, 118.2, 96.4, 88.7, 84.1] },
  { area: "NO2", today: [21.4, 15.2, 9.6, 2.4, -4.2, -8.3, -3.4, 6.8, 18.2, 31.3, 24.1, 16.2] },
  { area: "NO3", today: [44.1, 42.6, 41.9, null, 43.2, 51.7, 63.4, 70.2, 66.8, 58.1, 52.4, 49.9] },
];

/** One Sparkline per table row, each named by its row's area. A gap stays a gap. */
export function SparklineTable() {
  return (
    <Table.Root className="max-w-md w-full">
      <Table.Header>
        <Table.Row>
          <Table.Head>Area</Table.Head>
          <Table.Head>Today</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {AREAS.map(({ area, today }) => (
          <Table.Row key={area}>
            <Table.Cell>{area}</Table.Cell>
            <Table.Cell className="w-48">
              <Sparkline
                aria-label={`Spot price in ${area} today`}
                data={today}
                locale="en-US"
                format={{ preset: "unit-price", currency: "NOK", minor: true, vat: "excluded" }}
                emphasis="last"
              />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
