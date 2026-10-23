"use client";

import { Heading } from "@elmeragroup/fuse/heading";

export function HeadingStyles() {
  return (
    <div className="flex flex-col gap-3">
      <Heading level={1} typography="large">
        Welcome home
      </Heading>
      <Heading level={2} typography="medium">
        Choose your plan
      </Heading>
      <Heading level={3} typography="small">
        Your details
      </Heading>
      <Heading level={4} typography="xsmall">
        Delivery address
      </Heading>
    </div>
  );
}
