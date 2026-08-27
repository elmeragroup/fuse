"use client";

import { CalendarDate } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";

import { Calendar } from "@elmeragroup/ui/react-aria/calendar";

export function CalendarRtl() {
  return (
    <I18nProvider locale="ar-EG">
      <Calendar defaultValue={new CalendarDate(2026, 7, 14)} />
    </I18nProvider>
  );
}
