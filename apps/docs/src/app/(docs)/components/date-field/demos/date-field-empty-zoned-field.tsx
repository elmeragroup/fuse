"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldEmptyZonedField() {
  return <DateField label="Outage starts" granularity="minute" timeZone="Europe/Oslo" />;
}
