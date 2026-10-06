"use client";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { CaretRight } from "@elmeragroup/fuse/icons";

const sections = [
  { value: "contact", title: "Contact details", body: "Name, email and phone number." },
  { value: "address", title: "Delivery address", body: "Street, postcode and city." },
];

export function AccordionLeadingIndicator() {
  return (
    <Accordion.Root defaultValue={["contact"]}>
      {sections.map((section) => (
        <Accordion.Item key={section.value} value={section.value}>
          <Accordion.Header>
            <Accordion.Trigger indicator={null}>
              <CaretRight className="size-4 shrink-0 transition-transform duration-200 in-data-[panel-open]:rotate-90" />
              {section.title}
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>{section.body}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
