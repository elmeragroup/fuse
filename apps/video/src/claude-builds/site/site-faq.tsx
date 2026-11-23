import type { ReactElement } from "react";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Heading } from "@elmeragroup/fuse/heading";

import { useCopy } from "../../copy/copy";

/** The question that opens; the rest stay closed. */
const OPENED = "q0";

/**
 * The site's questions and answers as a Fuse Accordion under a Fuse heading. The first question
 * opens when `open` turns true; its motion is Fuse's own, which the caller seeks.
 *
 * @param props.open - Whether the first question is open.
 * @returns The questions, filling their section.
 */
export function SiteFaq({ open }: { readonly open: boolean }): ReactElement {
  const { faq } = useCopy().claudeBuilds.site;
  return (
    <section className="flex h-full flex-col items-center gap-8 bg-background px-10 pt-14 text-foreground">
      <Heading size="3xl" font="semi-bold" className="tracking-tight m-0 leading-9">
        {faq.title}
      </Heading>
      <Accordion.Root className="max-w-2xl w-full" value={open ? [OPENED] : []}>
        {faq.items.map((item, index) => (
          <Accordion.Item key={item.question} value={`q${String(index)}`}>
            <Accordion.Header>
              <Accordion.Trigger>{item.question}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>{item.answer}</Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}
