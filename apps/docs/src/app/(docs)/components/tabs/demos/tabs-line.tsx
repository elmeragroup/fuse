"use client";

import { Tabs } from "@elmeragroup/ui/tabs";

export function TabsLine() {
  return (
    <Tabs.Root defaultValue="overview">
      <Tabs.List variant="line">
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="usage">Usage</Tabs.Trigger>
        <Tabs.Trigger value="invoices">Invoices</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview">Two meters on the contract, both settled monthly.</Tabs.Content>
      <Tabs.Content value="usage">1 240 kWh across the period 1–31 March.</Tabs.Content>
      <Tabs.Content value="invoices">Invoice 10041 is outstanding. NOK 2 310,00.</Tabs.Content>
    </Tabs.Root>
  );
}
