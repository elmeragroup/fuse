import { Item } from "@elmeragroup/fuse/item";
import { Tabs } from "@elmeragroup/fuse/tabs";

import { ClientIsland } from "./client-island";

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
      <ClientIsland />
    </main>
  );
}
