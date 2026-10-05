import { Lightning, Plug } from "@elmeragroup/fuse/icons";

import type { Site } from "../site-model";

/** Fjordkraft Företag's business site in Swedish, after the fjordkraft.se reference. */
export const FJORDKRAFT_FORETAG_SITE = {
  brand: "fkab",
  name: "Fjordkraft Företag",
  domain: "fjordkraft.se",
  locale: "sv-SE",
  headings: "center",
  logo: "brand",
  caption: "Fjordkraft Företag's public website, built with Fuse",
  header: {
    layout: "stacked",
    nav: {
      label: "Huvudmeny",
      items: [
        {
          _tag: "Menu",
          label: "Elavtal",
          icon: Lightning,
          links: [
            {
              label: "Vintersäkring",
              href: "#vintersakring",
              description: "Förutsägbart elpris under vintern.",
            },
            { label: "Rörligt elpris", href: "#rorligt", description: "Följ marknaden timme för timme." },
            { label: "Fast elpris", href: "#fast", description: "Lås priset för hela avtalstiden." },
          ],
        },
        {
          _tag: "Menu",
          label: "Energilösningar",
          icon: Plug,
          links: [
            { label: "Förvaltning", href: "#forvaltning", description: "Låt våra förvaltare köpa in åt er." },
            { label: "Solceller", href: "#solceller", description: "Producera el på företagets tak." },
            { label: "Laddlösningar", href: "#laddning", description: "Laddning för personal och kunder." },
          ],
        },
        { _tag: "Link", label: "Varför välja oss", href: "#varfor" },
        { _tag: "Link", label: "Kontakta oss", href: "#kontakt" },
      ],
    },
    search: "Sök",
    cta: { label: "Bli kund", href: "#bli-kund" },
    signIn: { label: "Logga in", href: "#logga-in" },
    menu: "Meny",
  },
  hero: {
    layout: "promo",
    kicker: "Kampanj!",
    title: "Dags att vintersäkra elen till ditt företag",
    lede: "Få bättre kontroll över företagets elkostnader när elbehovet är som störst.",
    checklist: {
      label: "Fördelar",
      title: "Med Vintersäkring får du:",
      items: [
        "Ökad förutsägbarhet under vintern",
        "Möjlighet till lågt elpris på sommaren",
        "0 kr i påslag och månadsavgift i 6 månader",
      ],
    },
    actions: [
      { label: "Till erbjudandet", href: "#erbjudandet" },
      { label: "Bli kontaktad", href: "#kontaktad" },
    ],
    image: {
      src: "/landing/sites/fkab/hero.webp",
      alt: "En kvinna och en man i vinterkappor tittar på en surfplatta framför en kontorsbyggnad.",
      width: 900,
      height: 900,
    },
  },
  sections: [
    {
      _tag: "LinkCards",
      id: "genvagar",
      tone: "soft",
      title: "Genvägar",
      head: "label",
      cards: [
        {
          title: "Elavtal",
          text: "Det är enkelt att teckna ett nytt elavtal till företaget. Vi hanterar uppsägningen med din nuvarande leverantör.",
          link: { label: "Hitta elavtalet för ditt företag", href: "#elavtal" },
        },
        {
          title: "Webbinarium om elmarknaden",
          text: "Anmäl dig till våra webbinarier och få bättre koll på elmarknaden. Kvartalsvisa uppdateringar direkt från våra experter.",
          link: { label: "Anmäl dig", href: "#webbinarium" },
        },
        {
          title: "Mitt Företag",
          text: "Få en tydlig översikt över företagets energiförbrukning, kostnader och rapporter, samlat på ett ställe.",
          link: { label: "Till Mitt Företag", href: "#mitt-foretag" },
        },
      ],
    },
    {
      _tag: "Stories",
      id: "kunder",
      tone: "page",
      title: "Våra kunder",
      stories: [
        {
          image: {
            src: "/landing/sites/fkab/olearys.webp",
            alt: "Restaurangchefen på O’Learys står i baren tillsammans med två kollegor.",
            width: 926,
            height: 440,
          },
          title: "O’Learys-restaurangen sänkte sina elkostnader med 8 000 kronor i månaden",
          link: { label: "Läs mer", href: "#olearys" },
        },
        {
          image: {
            src: "/landing/sites/fkab/tehuset.webp",
            alt: "Två representanter för BRF Tehuset håller diplomet för Årets Elspararföretag och en blombukett.",
            width: 926,
            height: 440,
          },
          title: "BRF Tehuset i Ursvik har utsetts till Årets Elspararföretag av Fjordkraft Företag",
          link: { label: "Årets Elspararföretag", href: "#arets-elspararforetag" },
        },
        {
          image: {
            src: "/landing/sites/fkab/folkhogskola.webp",
            alt: "Porträtt av en man bredvid folkhögskolans flaggstänger och huvudbyggnad.",
            width: 926,
            height: 440,
          },
          title:
            "Tryggare energikostnader när Västra Sveriges Arbetares Folkhögskola gick över till Fjordkraft Företag",
          link: { label: "Läs mer", href: "#folkhogskola" },
        },
      ],
      more: { label: "Artiklar och nyheter", href: "#artiklar" },
    },
    {
      _tag: "Spotlights",
      id: "varfor",
      tone: "inverse",
      title: "Varför välja Fjordkraft?",
      head: "label",
      frame: "oval",
      order: "start",
      spotlights: [
        {
          image: {
            src: "/landing/sites/fkab/service.webp",
            alt: "Tre kundrådgivare med headset arbetar vid sina datorer.",
            width: 662,
            height: 542,
          },
          title: "Varför välja Fjordkraft?",
          paragraphs: [
            "Med erfarenhet och kunskap erbjuder vi elavtal och energilösningar för företag och föreningar. Med våra digitala tjänster tar kunderna full kontroll över sin elförbrukning och sina kostnader, och gör medvetna val för en bättre framtid.",
          ],
          checklist: {
            label: "Därför Fjordkraft",
            items: [
              "Lägre energikostnader",
              "Enkla och anpassade lösningar",
              "Effektiva energitjänster för framtiden",
            ],
          },
          action: { label: "Se våra elavtal", href: "#elavtal" },
        },
      ],
    },
    {
      _tag: "PriceArea",
      id: "elpris",
      tone: "soft",
      title: "Se elpriset i ditt område",
      lede: "Se dagens elpris timme för timme i ditt elområde, och planera företagets förbrukning efter det.",
      label: "Välj prisområde",
      placeholder: "Välj prisområde",
      unit: "öre/kWh",
      labels: {
        average: "Snitt i dag",
        low: "Lägst",
        high: "Högst",
        empty: "Välj ett prisområde för att se dagens timpriser.",
        chart: "Timpris i dag",
      },
      areas: [
        { code: "SE1", name: "Luleå", average: 28.41, low: 12.3, high: 41.92 },
        { code: "SE2", name: "Sundsvall", average: 31.07, low: 14.85, high: 46.2 },
        { code: "SE3", name: "Stockholm", average: 88.63, low: 52.14, high: 139.4 },
        { code: "SE4", name: "Malmö", average: 112.95, low: 70.2, high: 171.53 },
      ],
      note: {
        title: "Fyra elområden",
        text: "Sverige är indelat i fyra elområden, från SE1 i norr till SE4 i söder. Priset skiljer sig mellan dem eftersom mest el produceras i norr och mest används i söder.",
      },
    },
  ],
} as const satisfies Site;
