import type { BrandBookCopy } from "../catalog";

/** The brand book's English copy, the source the other catalogs translate. */
export const EN_US_BRAND_BOOK: BrandBookCopy = {
  identity: {
    tagline: "The Elmera Group design system",
  },
  schemes: {
    light: "Light",
    dark: "Dark",
  },
  palette: {
    caption: "Every brand fills the same roles.",
  },
  anatomy: {
    title: "Components read roles.",
    subtitle: "Themes set the values.",
    card: {
      title: "Meter reading",
      status: "Active",
      meter: "Meter number",
      notify: "Notify me",
      save: "Save reading",
      cancel: "Cancel",
    },
  },
  collage: {
    posterLabel: (version) => `Fuse ${version} · Components`,
    posterTitle: "The same components in every brand.",
    rolesTitle: "One set of roles.",
    dialog: {
      title: "Move the meter reading?",
      description: "The reading is copied to the new address.",
      cancel: "Cancel",
      confirm: "Move reading",
    },
    command: {
      query: "inv",
      placeholder: "Search actions…",
      items: [
        "New customer",
        "New invoice",
        "Register meter reading",
        "Customers",
        "Invoices",
        "Meter points",
      ],
    },
    sidebar: {
      group: "Workspace",
      items: ["Dashboard", "Orders", "Customers", "Invoices", "Reports"],
    },
    toast: {
      title: "Reading saved",
      description: (reading, meter) => `${reading} kWh registered for meter ${meter}.`,
    },
    select: {
      label: "Price area",
    },
    form: {
      title: "Contact details",
      email: "Email",
      phone: "Mobile",
      paper: "Paper invoice",
      save: "Save",
    },
    tabs: {
      items: ["Overview", "Invoices", "Agreements"],
      usage: "Electricity use",
    },
    periods: ["Day", "Week", "Month"],
    accordion: [
      { question: "When is the invoice sent?", answer: "On the first working day of each month." },
      { question: "Can I change my contract?", answer: "Yes, at any time." },
      { question: "How do I read my meter?", answer: "Send the number in the app." },
    ],
    alert: {
      title: "Meter reading due",
      description: "Send your reading before the end of the month.",
    },
    addons: {
      label: "Add-ons",
      alerts: "Price alerts",
      alertsDescription: "A message when the price spikes.",
      paper: "Paper invoice",
      paperDescription: "Sent to your address.",
    },
    contract: {
      label: "Contract",
      fixed: "Fixed price",
      spot: "Spot price",
    },
    budget: {
      slider: "Notify me at",
      meter: "Monthly budget",
    },
    breadcrumb: {
      customers: "Customers",
    },
    menu: {
      trigger: "Actions",
      items: ["Edit customer", "Send invoice", "Move reading"],
      destructive: "Close account",
    },
    popover: {
      trigger: "Price area",
      title: "Your price area",
      description: "The spot price follows the area your address belongs to.",
    },
    tooltip: "Download invoice",
    people: {
      since: (year) => `Customer since ${year}`,
    },
    empty: {
      title: "No invoices yet",
      description: "Invoices you receive will show up here.",
    },
    toolbar: {
      label: "Invoice actions",
      duplicate: "Duplicate",
    },
    timeline: ["Order placed", "Meter reading received", "Invoice issued"],
    details: {
      heading: "Customer",
      name: "Name",
      customerNumber: "Customer number",
      address: "Address",
    },
    combobox: {
      label: "Municipality",
    },
    type: {
      heading: "Your electricity",
      body: "Usage, invoices and agreements in one place.",
    },
    search: {
      placeholder: "Search customers",
    },
  },
  closing: {
    words: ["One system.", "Every brand."],
    caption: "The Elmera Group design system",
  },
};
