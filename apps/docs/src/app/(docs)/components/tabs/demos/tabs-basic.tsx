"use client";

import { Tabs } from "@elmeragroup/ui/tabs";

export function TabsBasic() {
  return (
    <Tabs.Root defaultValue="account">
      <Tabs.List>
        <Tabs.Trigger value="account">Account</Tabs.Trigger>
        <Tabs.Trigger value="password">Password</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account">Invoice 10041 is billed to the account holder.</Tabs.Content>
      <Tabs.Content value="password">Password changes take effect on the next sign-in.</Tabs.Content>
    </Tabs.Root>
  );
}
