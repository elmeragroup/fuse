import type { BrandBookCopy } from "../catalog";

/** The brand book's Swedish copy. Drafted; a native speaker reviews it before a public render. */
export const SV_SE_BRAND_BOOK: BrandBookCopy = {
  identity: {
    tagline: "Elmera Groups designsystem",
  },
  schemes: {
    light: "Ljust",
    dark: "Mörkt",
  },
  palette: {
    caption: "Alla varumärken fyller samma roller.",
  },
  anatomy: {
    title: "Komponenter läser roller.",
    subtitle: "Teman sätter värdena.",
    card: {
      title: "Mätaravläsning",
      status: "Aktiv",
      meter: "Mätarnummer",
      notify: "Meddela mig",
      save: "Spara avläsning",
      cancel: "Avbryt",
    },
  },
  collage: {
    posterLabel: (version) => `Fuse ${version} · Komponenter`,
    posterTitle: "Samma komponenter i alla varumärken.",
    rolesTitle: "En uppsättning roller.",
    dialog: {
      title: "Flytta mätaravläsningen?",
      description: "Avläsningen kopieras till den nya adressen.",
      cancel: "Avbryt",
      confirm: "Flytta avläsning",
    },
    command: {
      query: "fakt",
      placeholder: "Sök efter åtgärder …",
      items: ["Ny kund", "Ny faktura", "Registrera mätaravläsning", "Kunder", "Fakturor", "Mätpunkter"],
    },
    sidebar: {
      group: "Arbetsyta",
      items: ["Översikt", "Order", "Kunder", "Fakturor", "Rapporter"],
    },
    toast: {
      title: "Avläsning sparad",
      description: (reading, meter) => `${reading} kWh registrerat för mätare ${meter}.`,
    },
    select: {
      label: "Elområde",
    },
    form: {
      title: "Kontaktuppgifter",
      email: "E-post",
      phone: "Mobil",
      paper: "Pappersfaktura",
      save: "Spara",
    },
    tabs: {
      items: ["Översikt", "Fakturor", "Avtal"],
      usage: "Elförbrukning",
    },
    periods: ["Dag", "Vecka", "Månad"],
    accordion: [
      { question: "När skickas fakturan?", answer: "Första vardagen varje månad." },
      { question: "Kan jag byta avtal?", answer: "Ja, när som helst." },
      { question: "Hur läser jag av mätaren?", answer: "Skicka siffran i appen." },
    ],
    alert: {
      title: "Dags för mätaravläsning",
      description: "Skicka avläsningen före månadens slut.",
    },
    addons: {
      label: "Tillägg",
      alerts: "Prisvarning",
      alertsDescription: "Ett meddelande när priset stiger kraftigt.",
      paper: "Pappersfaktura",
      paperDescription: "Skickas till din adress.",
    },
    contract: {
      label: "Avtal",
      fixed: "Fast pris",
      spot: "Rörligt pris",
    },
    budget: {
      slider: "Meddela mig vid",
      meter: "Månadsbudget",
    },
    breadcrumb: {
      customers: "Kunder",
    },
    menu: {
      trigger: "Åtgärder",
      items: ["Redigera kund", "Skicka faktura", "Flytta avläsning"],
      destructive: "Avsluta konto",
    },
    popover: {
      trigger: "Elområde",
      title: "Ditt elområde",
      description: "Spotpriset följer det område din adress tillhör.",
    },
    tooltip: "Ladda ner faktura",
    people: {
      since: (year) => `Kund sedan ${year}`,
    },
    empty: {
      title: "Inga fakturor än",
      description: "Fakturor du får visas här.",
    },
    toolbar: {
      label: "Fakturaåtgärder",
      duplicate: "Duplicera",
    },
    timeline: ["Order lagd", "Mätaravläsning mottagen", "Faktura skickad"],
    details: {
      heading: "Kund",
      name: "Namn",
      customerNumber: "Kundnummer",
      address: "Adress",
    },
    combobox: {
      label: "Kommun",
    },
    type: {
      heading: "Din el",
      body: "Förbrukning, fakturor och avtal på ett ställe.",
    },
    search: {
      placeholder: "Sök efter kunder",
    },
  },
  closing: {
    words: ["Ett system.", "Alla varumärken."],
    caption: "Elmera Groups designsystem",
  },
};
