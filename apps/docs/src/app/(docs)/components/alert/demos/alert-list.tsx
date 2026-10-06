"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertList() {
  return (
    <Alert.Root variant="warning" className="max-w-lg">
      <Alert.Title>Before you move</Alert.Title>
      <Alert.Description>
        <p>Have these ready when you register the new address:</p>
        <ul className="list-disc pl-5">
          <li>The meter number at the new address</li>
          <li>The date you take over the keys</li>
          <li>A meter reading from that date</li>
        </ul>
      </Alert.Description>
    </Alert.Root>
  );
}
