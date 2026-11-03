"use client";

import { Link } from "@elmeragroup/fuse/link";
import { Text } from "@elmeragroup/fuse/text";

export function LinkRunningText() {
  return (
    <div className="max-w-sm flex flex-col gap-4">
      <Text size="lg">
        Meter readings arrive each night. See <Link href="#reading-schedule">when your meter reports</Link>.
      </Text>
      <Text size="sm" variant="muted">
        Prices include VAT. <Link href="#price-breakdown">Show the full price breakdown</Link>.
      </Text>
      <Text weight="medium">
        Your contract renews on 1 March. <Link href="#renewal">Review the renewal</Link>.
      </Text>
      <Text>
        Download{" "}
        <Link href="#statement">the settlement statement for March, with every meter reading and price</Link>{" "}
        for your records.
      </Text>
    </div>
  );
}
