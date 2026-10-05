import { FileMagnifyingGlass, Lifebuoy, Lightning, Phone } from "@elmeragroup/fuse/icons";

import type { Site } from "../site-model";

/** TrøndelagKraft's private-customer site in Norwegian, after the trondelagkraft.no reference. */
export const TRONDELAGKRAFT_SITE = {
  brand: "tkas",
  name: "TrøndelagKraft",
  domain: "trondelagkraft.no",
  locale: "nb-NO",
  headings: "center",
  logo: "wordmark",
  caption: "TrøndelagKraft's public website, built with Fuse",
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
            { label: "Velg strømavtale", href: "#avtaler", description: "Spotpris, fastpris og Norgespris." },
            { label: "Bestill strøm", href: "#bestill", description: "Bytt til oss på et par minutter." },
            { label: "Meld flytting", href: "#flytting", description: "Ta med avtalen til ny adresse." },
          ],
        },
        { _tag: "Link", label: "Kundeservice", href: "#kundeservice" },
        { _tag: "Link", label: "Strømpriser", href: "#strompriser" },
      ],
    },
    cta: { label: "Bli kunde", href: "#bli-kunde" },
    signIn: { label: "Min side", href: "#min-side" },
    menu: "Meny",
  },
  hero: {
    layout: "angled",
    title: "Få en enkel strømavtale",
    checklist: {
      label: "Fordeler",
      items: [
        "Ingen forskuddsbetaling",
        "Strøm og nettleie samlet på én regning",
        "Full kontroll på strømforbruket med TrøndelagKraft-appen",
      ],
    },
    actions: [{ label: "Bli kunde", href: "#bli-kunde" }],
    image: {
      src: "/landing/sites/tkas/hero.webp",
      alt: "En far og sønnen hans ler sammen i sofaen i en lys stue.",
      width: 1600,
      height: 1000,
    },
  },
  sections: [
    {
      _tag: "QuickLinks",
      id: "snarveier",
      tone: "page",
      title: "Snarveier",
      head: "label",
      style: "tabs",
      links: [
        { label: "Strømavtaler", href: "#avtaler" },
        { label: "Kundeservice", href: "#kundeservice" },
        { label: "Strømpriser", href: "#strompriser" },
        { label: "Min side", href: "#min-side" },
        { label: "App", href: "#app" },
      ],
    },
    {
      _tag: "Spotlights",
      id: "fordeler",
      tone: "page",
      title: "Fordeler for kunder",
      head: "label",
      frame: "panel",
      order: "alternate",
      spotlights: [
        {
          image: {
            src: "/landing/sites/tkas/shop.webp",
            alt: "En person handler i TrøndelagKraft-butikken på en bærbar PC.",
            width: 640,
            height: 377,
          },
          title: "Spar penger i nettbutikken",
          paragraphs: [
            "Som kunde hos TrøndelagKraft får du fordelspriser på smarte produkter i nettbutikken. Se nyhetene innen lading og strøm til hjemmet.",
          ],
          action: { label: "Gå til nettbutikken", href: "#nettbutikk" },
        },
        {
          image: {
            src: "/landing/sites/tkas/norgespris.webp",
            alt: "Et par smiler mens de ser på papirer sammen foran en bærbar PC.",
            width: 865,
            height: 400,
          },
          title: "Norgespris lønner seg i Trøndelag",
          paragraphs: [
            "Den siste tiden har stadig flere kunder i Midt-Norge valgt å bestille Norgespris, av den enkle grunn at det er forventet høye strømpriser fremover.",
          ],
          action: { label: "Slik fungerer Norgespris", href: "#norgespris" },
        },
        {
          image: {
            src: "/landing/sites/tkas/tobb.webp",
            alt: "Et eldre par slapper av i sofaen med hver sin kaffekopp.",
            width: 750,
            height: 630,
          },
          title: "Medlemsfordel på strøm",
          paragraphs: [
            "Sammen med TOBB tilbyr vi medlemsfordeler for alle – enten du er medlem, sitter i styret eller bor i et TOBB boligselskap.",
          ],
          action: { label: "Se TOBB spesialtilbud", href: "#tobb" },
        },
        {
          image: {
            src: "/landing/sites/tkas/benefits.webp",
            alt: "En hånd holder en mobil som viser kundefordelene i TrøndelagKraft-appen.",
            width: 1600,
            height: 1066,
          },
          title: "Hos oss har du mange kundefordeler",
          paragraphs: ["Se hvilke lokale rabatter og kundefordeler du har som kunde hos TrøndelagKraft."],
          action: { label: "Sjekk kundefordelene", href: "#kundefordeler" },
        },
      ],
    },
    {
      _tag: "Stories",
      id: "aktuelt",
      tone: "page",
      title: "Aktuelt",
      head: "label",
      stories: [
        {
          image: {
            src: "/landing/sites/tkas/grid.webp",
            alt: "Et ungt par i sofaen ser smilende på en mobil sammen.",
            width: 450,
            height: 300,
          },
          title: "Fem ting du bør vite om nettleie",
          link: { label: "Fem ting du bør vite om nettleie", href: "#nettleie" },
        },
        {
          image: {
            src: "/landing/sites/tkas/trygg.webp",
            alt: "Merket for DNVs sertifiserte system for Trygg strømhandel.",
            width: 450,
            height: 300,
          },
          title: "Trygg strømhandel",
          link: { label: "En trygghet for deg som kunde", href: "#trygg" },
        },
        {
          image: {
            src: "/landing/sites/tkas/usage.webp",
            alt: "En lys stue og spisestue med en hvit panelovn på veggen.",
            width: 450,
            height: 300,
          },
          title: "Lær mer om ditt strømforbruk",
          link: { label: "Hva bruker vi mest strøm til?", href: "#forbruk" },
        },
      ],
    },
    {
      _tag: "Help",
      id: "kontakt",
      tone: "soft",
      title: "Kontakt oss",
      head: "label",
      cards: [
        {
          visual: { _tag: "Icon", icon: Phone },
          title: "73 50 61 61",
          text: "Åpen hverdager 09–16.",
          actions: [{ label: "Ring oss", href: "#ring" }],
        },
        {
          visual: { _tag: "Icon", icon: Lifebuoy },
          title: "Chat med en rådgiver",
          text: "Få svar på chat, raskt og enkelt.",
          actions: [{ label: "Start chatbot", href: "#chat" }],
        },
        {
          visual: { _tag: "Icon", icon: FileMagnifyingGlass },
          title: "Ofte stilte spørsmål",
          text: "Spørsmål om strøm? Her finner du svarene.",
          actions: [{ label: "Kundeservice", href: "#kundeservice" }],
        },
      ],
    },
  ],
} as const satisfies Site;
