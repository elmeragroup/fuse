"use client";

import { Alert } from "@elmeragroup/ui/alert";

export function AlertVariants() {
  return (
    <div className="max-w-lg flex w-full flex-col gap-3">
      <Alert.Root>
        <Alert.Title>Scheduled maintenance</Alert.Title>
        <Alert.Description>Read-only access tonight from 22:00 to 23:00.</Alert.Description>
      </Alert.Root>
      <Alert.Root variant="destructive">
        <Alert.Title>Two meters are offline</Alert.Title>
        <Alert.Description>Billing for those sites is paused until they reconnect.</Alert.Description>
      </Alert.Root>
      <Alert.Root variant="warning">
        <Alert.Title>Sync delayed</Alert.Title>
        <Alert.Description>Facility data is more than an hour old.</Alert.Description>
      </Alert.Root>
      <Alert.Root variant="success">
        <Alert.Title>All meters reporting</Alert.Title>
        <Alert.Description>Last sync completed two minutes ago.</Alert.Description>
      </Alert.Root>
    </div>
  );
}
