"use client";

import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListLinks() {
  return (
    <TimelineList.Root>
      <TimelineList.Item>
        <TimelineList.Title>Invoice issued</TimelineList.Title>
        <TimelineList.Time date="2026-04-01">1 April 2026</TimelineList.Time>
        <TimelineList.Description>
          NOK 2 310,00 ready for payment.{" "}
          <a href="#invoice-4821" className="underline">
            View invoice 4821
          </a>
        </TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Title>Reminder sent</TimelineList.Title>
        <TimelineList.Time date="2026-04-15">15 April 2026</TimelineList.Time>
        <TimelineList.Description>
          Payment still open.{" "}
          <a href="#pay-4821" className="underline">
            Pay now
          </a>
        </TimelineList.Description>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
