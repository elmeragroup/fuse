import { Chart, Sparkline, formatChartValue } from "@elmeragroup/fuse/chart";
import { Item } from "@elmeragroup/fuse/item";
import { Tabs } from "@elmeragroup/fuse/tabs";

import { ClientIsland } from "./client-island";
import { OrdersTable } from "./orders-table";

export default function Page() {
  return (
    <main>
      <Item.Root>
        <Item.Content>
          <Item.Title id="server-title">Rendered on the server</Item.Title>
        </Item.Content>
      </Item.Root>
      <Tabs.Root defaultValue="first">
        <Tabs.List>
          <Tabs.Trigger value="first">First</Tabs.Trigger>
          <Tabs.Trigger value="second">Second</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="first">First panel</Tabs.Content>
        <Tabs.Content value="second">Second panel</Tabs.Content>
      </Tabs.Root>
      <p id="chart-headline">
        {
          formatChartValue(
            1.78,
            { preset: "unit-price", currency: "NOK", vat: "included" },
            { locale: "nb-NO" }
          ).text
        }
      </p>
      <Chart.Root id="chart-default" data={[]} config={{}} xKey="month" aria-label="Empty chart" />
      <Chart.Root
        id="chart-block"
        className="block"
        data={[]}
        config={{}}
        xKey="month"
        aria-label="Block chart"
      />
      <Sparkline id="sparkline" aria-label="Spot price" data={[1.2, 0.8, 1.6]} locale="nb-NO" />
      <ClientIsland />
      <OrdersTable />
    </main>
  );
}
