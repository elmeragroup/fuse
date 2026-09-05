"use client";

import { Tabs } from "@elmeragroup/ui/tabs";

export function TabsVertical() {
  return (
    <Tabs.Root defaultValue="delivery" orientation="vertical">
      <Tabs.List>
        <Tabs.Trigger value="delivery">Delivery</Tabs.Trigger>
        <Tabs.Trigger value="meter">Meter point</Tabs.Trigger>
        <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="delivery">Delivery window is weekdays 08:00–16:00.</Tabs.Content>
      <Tabs.Content value="meter">Meter 735999123 is the settlement point.</Tabs.Content>
      <Tabs.Content value="billing">Invoices are issued at the start of each month.</Tabs.Content>
    </Tabs.Root>
  );
}
