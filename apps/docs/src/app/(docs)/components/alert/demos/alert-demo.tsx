"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertDemo() {
  return (
    <Alert.Root className="max-w-lg">
      <Alert.Title>Scheduled maintenance</Alert.Title>
      <Alert.Description>Read-only access tonight from 22:00 to 23:00.</Alert.Description>
    </Alert.Root>
  );
}
