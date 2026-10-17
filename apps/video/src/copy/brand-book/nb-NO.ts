import type { BrandBookCopy } from "../catalog";

/** The brand book's Norwegian Bokmål copy. Drafted; a native speaker reviews it before a public render. */
export const NB_NO_BRAND_BOOK: BrandBookCopy = {
  identity: {
    tagline: "Designsystemet til Elmera Group",
  },
  schemes: {
    light: "Lys",
    dark: "Mørk",
  },
  palette: {
    caption: "Alle merkevarer fyller de samme rollene.",
  },
  anatomy: {
    title: "Komponenter leser roller.",
    subtitle: "Temaer setter verdiene.",
    card: {
      title: "Måleravlesning",
      status: "Aktiv",
      meter: "Målernummer",
      notify: "Varsle meg",
      save: "Lagre avlesning",
      cancel: "Avbryt",
    },
  },
  collage: {
    posterLabel: (version) => `Fuse ${version} · Komponenter`,
    posterTitle: "De samme komponentene i alle merkevarer.",
    rolesTitle: "Ett sett med roller.",
    dialog: {
      title: "Flytte måleravlesningen?",
      description: "Avlesningen kopieres til den nye adressen.",
      cancel: "Avbryt",
      confirm: "Flytt avlesning",
    },
    command: {
      query: "fak",
      placeholder: "Søk etter handlinger …",
      items: ["Ny kunde", "Ny faktura", "Registrer måleravlesning", "Kunder", "Fakturaer", "Målepunkter"],
    },
    sidebar: {
      group: "Arbeidsområde",
      items: ["Oversikt", "Ordrer", "Kunder", "Fakturaer", "Rapporter"],
    },
    toast: {
      title: "Avlesning lagret",
      description: (reading, meter) => `${reading} kWh registrert på måler ${meter}.`,
    },
    select: {
      label: "Prisområde",
    },
    form: {
      title: "Kontaktinformasjon",
      email: "E-post",
      phone: "Mobil",
      paper: "Papirfaktura",
      save: "Lagre",
    },
    tabs: {
      items: ["Oversikt", "Fakturaer", "Avtaler"],
      usage: "Strømforbruk",
    },
    periods: ["Dag", "Uke", "Måned"],
    accordion: [
      { question: "Når sendes fakturaen?", answer: "Første virkedag i hver måned." },
      { question: "Kan jeg bytte avtale?", answer: "Ja, når som helst." },
      { question: "Hvordan leser jeg av måleren?", answer: "Send tallet i appen." },
    ],
    alert: {
      title: "Tid for måleravlesning",
      description: "Send avlesningen før slutten av måneden.",
    },
    addons: {
      label: "Tillegg",
      alerts: "Prisvarsel",
      alertsDescription: "En melding når prisen stiger kraftig.",
      paper: "Papirfaktura",
      paperDescription: "Sendes til adressen din.",
    },
    contract: {
      label: "Avtale",
      fixed: "Fastpris",
      spot: "Spotpris",
    },
    budget: {
      slider: "Varsle meg ved",
      meter: "Månedsbudsjett",
    },
    breadcrumb: {
      customers: "Kunder",
    },
    menu: {
      trigger: "Handlinger",
      items: ["Rediger kunde", "Send faktura", "Flytt avlesning"],
      destructive: "Avslutt konto",
    },
    popover: {
      trigger: "Prisområde",
      title: "Ditt prisområde",
      description: "Spotprisen følger området adressen din hører til.",
    },
    tooltip: "Last ned faktura",
    people: {
      since: (year) => `Kunde siden ${year}`,
    },
    empty: {
      title: "Ingen fakturaer ennå",
      description: "Fakturaer du får, vises her.",
    },
    toolbar: {
      label: "Fakturahandlinger",
      duplicate: "Dupliser",
    },
    timeline: ["Ordre lagt inn", "Måleravlesning mottatt", "Faktura sendt"],
    details: {
      heading: "Kunde",
      name: "Navn",
      customerNumber: "Kundenummer",
      address: "Adresse",
    },
    combobox: {
      label: "Kommune",
    },
    type: {
      heading: "Strømmen din",
      body: "Forbruk, fakturaer og avtaler på ett sted.",
    },
    search: {
      placeholder: "Søk etter kunder",
    },
  },
  closing: {
    words: ["Ett system.", "Alle merkevarer."],
    caption: "Designsystemet til Elmera Group",
  },
};
