"use client";

import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListCustomIndicator() {
  return (
    <TimelineList.Root indicatorSize="md">
      <TimelineList.Item
        indicator={
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-foreground">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
              <path d="M9.5 1 3 9h4.5L6 15l7-8.5H8.5z" />
            </svg>
          </span>
        }>
        <TimelineList.Title>Power restored</TimelineList.Title>
        <TimelineList.Time date="2026-03-12T09:15+01:00">12 March 2026 at 09:15</TimelineList.Time>
      </TimelineList.Item>
      <TimelineList.Item
        indicator={
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-foreground">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
              <path d="M3 2h10v12H3zm2 2v2h6V4zm0 4v1h6V8zm0 3v1h4v-1z" />
            </svg>
          </span>
        }>
        <TimelineList.Title>Invoice issued</TimelineList.Title>
        <TimelineList.Time date="2026-04-01">1 April 2026</TimelineList.Time>
      </TimelineList.Item>
      <TimelineList.Item indicator={null}>
        <TimelineList.Title>Reminder scheduled</TimelineList.Title>
        <TimelineList.Time date="2026-04-15">15 April 2026</TimelineList.Time>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
