"use client";

import { Badge } from "@elmeragroup/ui/badge";

export function BadgeStatus() {
  return (
    <ul className="flex flex-col gap-2">
      <li className="flex items-center gap-2">
        <span>Order 10041</span>
        <Badge variant="success">Delivered</Badge>
      </li>
      <li className="flex items-center gap-2">
        <span>Order 10042</span>
        <Badge variant="warning">Awaiting meter reading</Badge>
      </li>
      <li className="flex items-center gap-2">
        <span>Order 10043</span>
        <Badge variant="info">Scheduled</Badge>
      </li>
      <li className="flex items-center gap-2">
        <span>Order 10044</span>
        <Badge variant="destructive">Cancelled</Badge>
      </li>
    </ul>
  );
}
