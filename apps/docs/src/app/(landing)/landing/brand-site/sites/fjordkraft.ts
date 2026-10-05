import {
  DeviceMobile,
  FileMagnifyingGlass,
  Lifebuoy,
  Lightning,
  Phone,
  Storefront,
} from "@elmeragroup/fuse/icons";

import type { Site } from "../site-model";

/** Fjordkraft's private-customer site in Norwegian, after the fjordkraft.no reference. */
export const FJORDKRAFT_SITE = {
  brand: "fkas",
  name: "Fjordkraft",
  domain: "fjordkraft.no",
  locale: "nb-NO",
  headings: "center",
  logo: "brand",
  caption: "Fjordkraft's public website, built with Fuse",
  header: {
    layout: "stacked",
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
          label: "Strøm",
          icon: Lightning,
          links: [
            {
              label: "Strømavtaler",
              href: "#stromavtaler",
              description: "Spotpris, fastpris og Norgespris.",
            },
            { label: "Bestill strøm", href: "#bestill", description: "Bytt til oss på et par minutter." },
            { label: "Dagens strømpris", href: "#strompris", description: "Timepriser for ditt prisområde." },
            { label: "Flytting", href: "#flytting", description: "Ta med strømavtalen til ny adresse." },
          ],
        },
        {
          _tag: "Menu",
          label: "Mobil",
          icon: DeviceMobile,
          links: [
            {
              label: "Mobilabonnement",
              href: "#mobil",
              description: "Fri data eller fast mengde, uten binding.",
            },
            { label: "Familie", href: "#familie", description: "Samle hele husstanden på én regning." },
            { label: "Bytt nummer til oss", href: "#porter", description: "Vi ordner overføringen for deg." },
          ],
        },
        {
          _tag: "Menu",
          label: "Nettbutikk",
          icon: Storefront,
          links: [
            { label: "Elbillading", href: "#lading", description: "Ladebokser med montering." },
            { label: "Smarthus", href: "#smarthus", description: "Styr varme og forbruk fra appen." },
            { label: "Solceller", href: "#solceller", description: "Produser din egen strøm." },
          ],
        },
      ],
    },
    search: "Søk",
    cta: { label: "Bestill strøm", href: "#bestill" },
    signIn: { label: "Logg inn", href: "#logg-inn" },
    menu: "Meny",
  },
  hero: {
    layout: "card",
    title: "Bytt strømleverandør raskt og enkelt",
    checklist: {
      label: "Fordeler",
      items: [
        "Få hjelp til å spare i Fjordkraft-appen",
        "Ingen skjulte gebyrer eller påslag",
        "Strøm og nettleie samlet på én regning",
      ],
    },
    actions: [{ label: "Bli kunde", href: "#bli-kunde" }],
    image: {
      src: "/landing/sites/fkas/hero.webp",
      alt: "Et barn heller melk i frokostblandingen mens en voksen sjekker strømforbruket i Fjordkraft-appen ved kjøkkenbordet.",
      width: 900,
      height: 900,
    },
  },
  sections: [
    {
      _tag: "Help",
      id: "norgespris",
      tone: "page",
      title: "Spørsmål om Norgespris?",
      cards: [
        {
          visual: { _tag: "Icon", icon: FileMagnifyingGlass },
          title: "Norgespris i 2027",
          text: "Norgespris fastsettes i statsbudsjettet, og vi forventer at bestillingen åpner i desember.",
          actions: [{ label: "Norgespris fremover", href: "#norgespris-2027" }],
        },
        {
          visual: { _tag: "Icon", icon: Lifebuoy },
          title: "Ofte stilte spørsmål",
          text: "Lær mer om hva Norgespris er, hvordan du bestiller og hvordan det ser ut på fakturaen.",
          actions: [{ label: "Spørsmål og svar", href: "#sporsmal" }],
        },
        {
          visual: { _tag: "Icon", icon: Phone },
          title: "Chat med oss",
          text: "Få hjelp raskt og enkelt.",
          actions: [{ label: "Start chatbot", href: "#chat" }],
        },
      ],
    },
    {
      _tag: "PriceArea",
      id: "strompris",
      tone: "strong",
      title: "Sjekk dagens strømpris",
      lede: "Hva er dagens strømpris der du bor? Se strømpriser time for time, og finn ut når det er billig strøm i området ditt.",
      label: "Velg prisområde",
      placeholder: "Velg prisområde",
      unit: "øre/kWh",
      labels: {
        average: "Snitt i dag",
        low: "Lavest",
        high: "Høyest",
        empty: "Velg et prisområde for å se timeprisene i dag.",
        chart: "Timepris i dag",
      },
      areas: [
        { code: "NO1", name: "Øst-Norge", average: 92.41, low: 61.2, high: 131.08 },
        { code: "NO2", name: "Sør-Norge", average: 88.17, low: 58.93, high: 124.6 },
        { code: "NO3", name: "Midt-Norge", average: 34.82, low: 21.05, high: 47.33 },
        { code: "NO4", name: "Nord-Norge", average: 12.06, low: 4.18, high: 19.72 },
        { code: "NO5", name: "Vest-Norge", average: 84.12, low: 55.4, high: 119.91 },
      ],
      note: {
        title: "Trygg strømhandel",
        text: "Vi er godkjent gjennom sertifiseringsordningen Trygg strømhandel. Ordningen skal sikre kvaliteten i blant annet salg, produktinformasjon og markedsføring av strøm.",
      },
    },
    {
      _tag: "Stories",
      id: "einar",
      tone: "soft",
      title: "Følg strømmen med Einar",
      lede: "Bli med hjem til familier som gjør små og store grep for å kutte strømregningen sin.",
      stories: [
        {
          image: {
            src: "/landing/sites/fkas/renovated.webp",
            alt: "Einar peker opp mot taket i en trappeoppgang mens huseieren følger med.",
            width: 926,
            height: 440,
          },
          title: "Det nyoppussede huset: Se strømsparetipsene til Bente og Bjarne.",
          link: { label: "Hundre år gammelt hus", href: "#hundre-ar" },
        },
        {
          image: {
            src: "/landing/sites/fkas/student.webp",
            alt: "Einar og en student står smilende på kjøkkenet i en leilighet.",
            width: 926,
            height: 440,
          },
          title: "Hvor god kontroll har studenten på hvor mye strøm som brukes i leiligheten?",
          link: { label: "Boligeier og student", href: "#student" },
        },
        {
          image: {
            src: "/landing/sites/fkas/newbuild.webp",
            alt: "Einar håndhilser på en mann som holder en eske med en smartmåler foran en garasje.",
            width: 600,
            height: 300,
          },
          title: "Paret har kommet seg på plass i et helt nytt hus. Hvordan går det med strømmen?",
          link: { label: "Nybygg med smarte løsninger", href: "#nybygg" },
        },
      ],
      more: { label: "Se episodene", href: "#episoder" },
    },
    {
      _tag: "Help",
      id: "hjelp",
      tone: "inverse",
      title: "Hvordan kan vi hjelpe deg?",
      cards: [
        {
          visual: { _tag: "Icon", icon: Phone },
          title: "Ring 23 00 61 00",
          text: "Vi er åpne hverdager 09–16.",
          actions: [{ label: "Ring oss", href: "#ring" }],
        },
        {
          visual: { _tag: "Icon", icon: Lifebuoy },
          title: "Chat med oss",
          text: "Få hjelp raskt og enkelt.",
          actions: [{ label: "Start chatbot", href: "#chat" }],
        },
        {
          visual: { _tag: "Icon", icon: FileMagnifyingGlass },
          title: "Ofte stilte spørsmål",
          text: "Finn svar på det du lurer på.",
          actions: [{ label: "Spørsmål og svar", href: "#sporsmal" }],
        },
      ],
    },
  ],
} as const satisfies Site;
