"use client";

import { Tabs } from "@elmeragroup/ui/tabs";

export function TabsDisabled() {
  return (
    <Tabs.Root defaultValue="account">
      <Tabs.List>
        <Tabs.Trigger value="account">Account</Tabs.Trigger>
        <Tabs.Trigger value="password" disabled>
          Password
        </Tabs.Trigger>
        <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account">Invoice 10041 is billed to the account holder.</Tabs.Content>
      <Tabs.Content value="password">Password changes take effect on the next sign-in.</Tabs.Content>
      <Tabs.Content value="billing">Invoices are issued at the start of each month.</Tabs.Content>
    </Tabs.Root>
  );
}
