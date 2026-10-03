import { Lightning, User } from "@elmeragroup/fuse/icons";

import type { Site } from "../site-model";

/** Telinet Energi's private-customer site in Swedish, after the telinet.se reference. */
export const TELINET_SITE = {
  brand: "fkse",
  name: "Telinet Energi",
  domain: "telinet.se",
  lang: "sv",
  locale: "sv-SE",
  headings: "center",
  logo: "wordmark",
  caption: "Telinet Energi's public website, built with Fuse",
  header: {
    layout: "single",
    segments: {
      label: "Kundtyp",
      items: [
        { label: "Privat", href: "#privat" },
        { label: "Företag", href: "#foretag" },
      ],
    },
    utility: [{ label: "Kundservice", href: "#kundservice" }],
    nav: {
      label: "Huvudmeny",
      items: [
        {
          _tag: "Menu",
          label: "Elavtal",
          icon: Lightning,
          links: [
            {
              label: "Rörligt elpris",
              href: "#rorligt",
              description: "Följ marknadspriset timme för timme.",
            },
            { label: "Fast elpris", href: "#fast", description: "Samma pris i ett, två eller tre år." },
            { label: "Flytta elavtal", href: "#flytta", description: "Ta med avtalet till din nya adress." },
          ],
        },
        {
          _tag: "Menu",
          label: "Mina sidor",
          icon: User,
          links: [
            { label: "Fakturor", href: "#fakturor", description: "Se och betala dina fakturor." },
            { label: "Förbrukning", href: "#forbrukning", description: "Din elanvändning per timme." },
            { label: "Tillval", href: "#tillval", description: "Lägg till eller ta bort tjänster." },
          ],
        },
        { _tag: "Link", label: "Om oss", href: "#om-oss" },
      ],
    },
    search: "Sök",
    cta: { label: "Teckna elavtal", href: "#teckna" },
    signIn: { label: "Logga in", href: "#logga-in" },
    menu: "Meny",
  },
  hero: {
    layout: "overlay",
    title: "Det här är Telinet Energi",
    tiles: [
      {
        title: "Teckna ett 100 % förnybart elavtal",
        text: "Välj ett fast eller rörligt elavtal med energi från solen, vinden och vattnet.",
        href: "#teckna",
      },
      {
        title: "Glöm inte elavtalet när du ska flytta",
        text: "Som befintlig Telinetkund får du flyttgåvor samtidigt som vi hjälper dig att flytta ditt elavtal.",
        href: "#flytta",
      },
      {
        title: "Skräddarsy din el med våra tillval",
        text: "Anpassa ditt elavtal med våra extratjänster och hitta de tillval som passar dig bäst.",
        href: "#tillval",
      },
    ],
    image: {
      src: "/landing/sites/fkse/hero.webp",
      alt: "Klippor vid havet i skymningen, med skär mot en rosa himmel.",
      width: 1600,
      height: 533,
    },
  },
  sections: [
    {
      _tag: "Spotlights",
      id: "fornybart",
      tone: "strong",
      title: "Förnybar energi",
      head: "label",
      frame: "art",
      order: "start",
      spotlights: [
        {
          image: {
            src: "/landing/sites/fkse/wind.webp",
            alt: "Illustration av två vindkraftverk under en sol, ovanför havets vågor.",
            width: 360,
            height: 400,
          },
          title: "Förnybar energi, idag och imorgon!",
          paragraphs: [
            "All energi vi säljer kommer från förnybara källor som solen, vinden och vattnet. Vi jobbar varje dag för att kunna erbjuda marknadens bästa priser på förnybar el – med billiga elavtal, enkla tjänster och en kundservice som ger dig mer tid över till sånt du gillar.",
          ],
          action: { label: "Här kan du läsa mer om vårt miljöarbete", href: "#miljo" },
        },
      ],
    },
    {
      _tag: "Help",
      id: "kundservice",
      tone: "page",
      title: "Kundservice och app",
      head: "label",
      cards: [
        {
          visual: {
            _tag: "Photo",
            image: {
              src: "/landing/sites/fkse/service.webp",
              alt: "En kundservicemedarbetare med headset ler vid sin arbetsplats.",
              width: 512,
              height: 284,
            },
          },
          title: "Vi finns här för dig!",
          text: "Vår högsta prioritet är att du ska vara nöjd med vår service och ditt elavtal. De flesta svaren finns i appen och här på sidan, och vårt kundserviceteam når du via telefon, chatt eller mejl.",
          actions: [
            { label: "0771-456 150", href: "#ring" },
            { label: "Mejla oss här", href: "#mejla" },
          ],
        },
        {
          visual: {
            _tag: "Photo",
            image: {
              src: "/landing/sites/fkse/app.webp",
              alt: "Tre mobiler som visar Telinet-appens översikt, förbrukning och elpris.",
              width: 1080,
              height: 600,
            },
          },
          title: "Telinet-appen",
          text: "I Telinet-appen ser du dina elavtal, fakturor och din solcellsproduktion. Följ elpriset per kvart, få en kostnadsprognos, styr ditt smarta hem och jämför din förbrukning med dina grannars.",
          actions: [
            { label: "Ladda ner för iPhone", href: "#iphone" },
            { label: "Ladda ner för Android", href: "#android" },
          ],
        },
      ],
    },
    {
      _tag: "Spotlights",
      id: "elmarknaden",
      tone: "page",
      title: "Elmarknaden",
      head: "label",
      frame: "card",
      order: "end",
      spotlights: [
        {
          image: {
            src: "/landing/sites/fkse/market.webp",
            alt: "En kvinna luktar på rosa körsbärsblommor.",
            width: 1600,
            height: 1067,
          },
          kicker: "Elpriserna och nuläget",
          title: "Vad händer på elmarknaden?",
          paragraphs: [
            "För dig som vill förstå hur elmarknaden fungerar och vad som påverkar priserna kan det vara värdefullt att hålla sig uppdaterad. Därför reder vi ut vad som faktiskt händer på elmarknaden.",
          ],
          action: { label: "Ta reda på mer", href: "#elmarknaden" },
        },
      ],
    },
    {
      _tag: "Closing",
      id: "kom-igang",
      tone: "soft",
      title: "Kom igång med Telinet nu!",
      lede: "Teckna ett förnybart elavtal på några minuter. Vi sköter bytet från din nuvarande leverantör.",
      actions: [{ label: "Teckna elavtal", href: "#teckna" }],
    },
    {
      _tag: "Partners",
      id: "partners",
      tone: "page",
      title: "Bra partners ger bättre energi.",
      partners: ["Villaägarna", "Barncancerfonden", "Kivra", "Zeromission", "Trygg kundkontakt"],
    },
  ],
} as const satisfies Site;
