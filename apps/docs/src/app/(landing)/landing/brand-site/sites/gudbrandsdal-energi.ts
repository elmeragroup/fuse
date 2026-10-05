import { Lightning } from "@elmeragroup/fuse/icons";

import type { Site } from "../site-model";

/** Gudbrandsdal Energi's private-customer site in Norwegian, after the ge.no reference. */
export const GUDBRANDSDAL_ENERGI_SITE = {
  brand: "guen",
  name: "Gudbrandsdal Energi",
  domain: "ge.no",
  locale: "nb-NO",
  headings: "split",
  logo: "wordmark",
  caption: "Gudbrandsdal Energi's public website, built with Fuse",
  header: {
    layout: "single",
    segments: {
      label: "Kundetype",
      items: [
        { label: "Privat", href: "#privat" },
        { label: "Bedrift", href: "#bedrift" },
      ],
    },
    nav: {
      label: "Hovedmeny",
      items: [
        {
          _tag: "Menu",
          label: "Strømavtaler",
          icon: Lightning,
          links: [
            { label: "Høstkampanje", href: "#kampanje", description: "Strømavtalen til høstpris." },
            { label: "Norgespris", href: "#norgespris", description: "Fast pris fra staten." },
            { label: "Dagens strømpris", href: "#strompris", description: "Timepriser i ditt område." },
          ],
        },
        { _tag: "Link", label: "Kundeservice", href: "#kundeservice" },
        { _tag: "Link", label: "Min side", href: "#min-side" },
      ],
    },
    cta: { label: "Bestill strøm", href: "#bestill" },
    menu: "Meny",
  },
  hero: {
    layout: "panel",
    title: "Høstkampanje på strømavtale",
    lede: "Bytt til Gudbrandsdal Energi i høst. Velg strømavtalen som passer deg, så ordner vi resten av byttet.",
    actions: [{ label: "Se kampanjetilbud", href: "#kampanje" }],
    image: {
      src: "/landing/sites/guen/hero.webp",
      alt: "Fjell med nysnø over et blått vann og bjørkeskog i høstfarger.",
      width: 1200,
      height: 715,
    },
  },
  sections: [
    {
      _tag: "QuickLinks",
      id: "snarveier",
      tone: "page",
      title: "Snarveier",
      head: "label",
      style: "tiles",
      links: [
        { label: "Dagens strømpris", href: "#strompris" },
        { label: "Norgespris", href: "#norgespris" },
        { label: "Se strømavtaler", href: "#avtaler" },
      ],
    },
    {
      _tag: "Reviews",
      id: "kundene",
      tone: "page",
      title: "Dette sier kundene våre",
      ratingLabel: "av 5 stjerner",
      reviews: [
        {
          rating: 5,
          title: "Anbefales på det varmeste",
          quote:
            "Super service og trygg strøm hele veien med full oversikt på app og i nettleseren uansett når – flinke folk som svarer raskt og profesjonelt.",
          author: "Linda Ø på bytt.no",
        },
        {
          rating: 5,
          title: "Utmerket strømleverandør!",
          quote:
            "Jeg synes det aller meste, og i alle fall det som betyr noe for meg når det gjelder strømleverandør, fungerer helt utmerket. Når jeg tar kontakt med dere, får jeg raske og fornuftige svar.",
          author: "Paul S på bytt.no",
        },
        {
          rating: 5,
          title: "Utmerket og super hyggelige medarbeidere på kundeservice",
          quote:
            "Kundeservicen til GE er så personlig og god at den alene er grunn nok til å være kunde der.",
          author: "Leif på bytt.no",
        },
      ],
    },
    {
      _tag: "Spotlights",
      id: "verv",
      tone: "page",
      title: "Verv en venn",
      head: "label",
      frame: "soft",
      order: "start",
      spotlights: [
        {
          image: {
            src: "/landing/sites/guen/friend.webp",
            alt: "To venninner står på en steinstrand ved et fjellvann og smiler til hverandre.",
            width: 960,
            height: 963,
          },
          title: "Verv en venn",
          lead: "Er du en fornøyd kunde?",
          paragraphs: [
            "Gi en venn, nabo eller andre muligheten til å få samme gode strømleverandør som deg.",
            "Inviter dem til Gudbrandsdal Energi, så får dere 500 fordelspoeng hver når vennen din blir kunde.",
          ],
          action: { label: "Kom i gang med verving", href: "#verving" },
        },
      ],
    },
  ],
} as const satisfies Site;
