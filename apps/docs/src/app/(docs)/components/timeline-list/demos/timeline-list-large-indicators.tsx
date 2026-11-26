"use client";

import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListLargeIndicators() {
  return (
    <TimelineList.Root indicatorSize="lg">
      <TimelineList.Item status="complete">
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Order placed</TimelineList.Title>
          <TimelineList.Time date="2026-03-03">3 March 2026</TimelineList.Time>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item status="current">
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Meter installation</TimelineList.Title>
          <TimelineList.Time date="2026-03-10">10 March 2026</TimelineList.Time>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item status="upcoming">
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>First invoice</TimelineList.Title>
          <TimelineList.Time date="2026-04-01">1 April 2026</TimelineList.Time>
        </TimelineList.Content>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
