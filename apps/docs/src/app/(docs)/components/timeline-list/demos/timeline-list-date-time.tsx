"use client";

import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListDateTime() {
  return (
    <TimelineList.Root>
      <TimelineList.Item>
        <TimelineList.Title>Outage reported</TimelineList.Title>
        <TimelineList.Time date="2026-03-12T06:40+01:00">12 March 2026 at 06:40</TimelineList.Time>
        <TimelineList.Description>Reported by the grid company for Storgata.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Title>Power restored</TimelineList.Title>
        <TimelineList.Time date="2026-03-12T09:15+01:00">12 March 2026 at 09:15</TimelineList.Time>
        <TimelineList.Description>Every meter on the street is back online.</TimelineList.Description>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
