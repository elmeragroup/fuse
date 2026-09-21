"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertHeadingLevel() {
  return (
    <section className="max-w-lg flex w-full flex-col gap-3">
      <h2 className="text-lg font-medium">Invoice 1042</h2>
      <Alert.Root>
        <Alert.Title level={3}>Payment received</Alert.Title>
        <Alert.Description>The receipt was emailed to the billing contact.</Alert.Description>
      </Alert.Root>
    </section>
  );
}
