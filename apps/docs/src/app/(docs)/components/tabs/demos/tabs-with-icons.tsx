"use client";

import { Lock, User } from "@elmeragroup/ui/icons";
import { Tabs } from "@elmeragroup/ui/tabs";

export function TabsWithIcons() {
  return (
    <Tabs.Root defaultValue="account">
      <Tabs.List>
        <Tabs.Trigger value="account">
          <User data-icon="inline-start" aria-hidden />
          Account
        </Tabs.Trigger>
        <Tabs.Trigger value="password">
          <Lock data-icon="inline-start" aria-hidden />
          Password
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account">Contact and billing details for the account holder.</Tabs.Content>
      <Tabs.Content value="password">Password changes take effect on the next sign-in.</Tabs.Content>
    </Tabs.Root>
  );
}
