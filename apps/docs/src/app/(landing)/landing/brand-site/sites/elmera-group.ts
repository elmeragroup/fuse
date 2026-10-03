import { Buildings, House, Lightning } from "@elmeragroup/fuse/icons";

import type { Site } from "../site-model";

/** Elmera Group's corporate site in English, after the elmeragroup.no reference. */
export const ELMERA_GROUP_SITE = {
  brand: "elma",
  name: "Elmera Group",
  domain: "elmeragroup.no",
  lang: "en",
  locale: "en-US",
  headings: "split",
  logo: "elmera-group",
  caption: "Elmera Group's corporate website, built with Fuse",
  header: {
    layout: "single",
    nav: {
      label: "Main",
      items: [
        {
          _tag: "Menu",
          label: "Our group",
          links: [
            { label: "About Elmera", href: "#about", description: "Who we are and how the group is run." },
            { label: "Our brands", href: "#brands", description: "Energy brands across the Nordics." },
            { label: "Management", href: "#management", description: "The executive team and the board." },
          ],
        },
        {
          _tag: "Menu",
          label: "Investors",
          links: [
            {
              label: "Reports & presentations",
              href: "#reports",
              description: "Quarterly and annual reporting.",
            },
            {
              label: "Financial calendar",
              href: "#calendar",
              description: "Results dates and the general meeting.",
            },
            { label: "The share", href: "#share", description: "ELMRA on Oslo Børs." },
            { label: "Governance", href: "#governance", description: "Articles, policies and the board." },
          ],
        },
        {
          _tag: "Menu",
          label: "Sustainability",
          links: [
            { label: "Our approach", href: "#approach", description: "Targets for our own operations." },
            { label: "Reporting", href: "#esg", description: "Climate accounts and ESG data." },
            { label: "Supplier code", href: "#suppliers", description: "What we ask of our suppliers." },
          ],
        },
        { _tag: "Link", label: "News", href: "#news" },
        { _tag: "Link", label: "Careers", href: "#careers" },
      ],
    },
    cta: { label: "Contact us", href: "#contact" },
    menu: "Menu",
  },
  hero: {
    layout: "centered",
    announcement: {
      text: "Q2 2026 results are out",
      link: { label: "Read the report", href: "#q2-2026" },
    },
    title: "Preferred by more customers. Every day.",
    lede: "Elmera Group owns energy brands, billing technology and customer service for a million homes and businesses in Norway, Sweden and Finland. Listed on Oslo Børs, headquartered in Bergen.",
    actions: [
      { label: "Discover our group", href: "#group" },
      { label: "Investor relations", href: "#investors" },
    ],
  },
  sections: [
    {
      _tag: "Share",
      id: "share",
      tone: "soft",
      title: "The share",
      lede: "ELMRA is listed on Oslo Børs. Reports, presentations and the financial calendar are published here first.",
      actions: [
        { label: "Reports & presentations", href: "#reports" },
        { label: "Subscribe to updates", href: "#subscribe" },
      ],
      quote: {
        ticker: "ELMRA · Oslo Børs",
        price: 46.6,
        currency: "NOK",
        change: 0.65,
        changeLabel: "today",
        history: [43.1, 43.4, 43.2, 44.1, 43.9, 44.6, 44.4, 45.3, 45.0, 45.8, 45.6, 46.3, 46.1, 46.6],
        facts: [
          { label: "Market cap", value: "NOK 5.3 bn" },
          { label: "Dividend 2025", value: "NOK 3.25" },
          { label: "52-week range", value: "38.20–48.10" },
        ],
        updated: "Updated 15 Sep 2026, 10:11 CEST · 15 min delay",
      },
      calendar: {
        title: "Financial calendar",
        events: [
          { date: "2026-11-12", title: "Quarterly report · Q3 2026", detail: "Webcast 08:00 CET" },
          { date: "2027-02-11", title: "Quarterly report · Q4 2026", detail: "Preliminary annual results" },
          { date: "2027-04-22", title: "Annual general meeting", detail: "Bergen, Norway" },
        ],
      },
    },
    {
      _tag: "Brands",
      id: "brands",
      tone: "page",
      title: "Our brands",
      lede: "Energy brands across Norway and Sweden, each with its own identity. Pick one to see its site.",
      brands: [
        { brand: "fkas", name: "Fjordkraft", text: "Electricity for homes & businesses" },
        { brand: "tkas", name: "TrøndelagKraft", text: "Local power in Trøndelag" },
        { brand: "guen", name: "Gudbrandsdal Energi", text: "Electricity for Norwegian homes" },
        { brand: "fkse", name: "Telinet Energi", text: "Electricity for Swedish homes" },
        { brand: "fkab", name: "Fjordkraft Företag", text: "Power for Nordic businesses" },
      ],
    },
    {
      _tag: "Features",
      id: "what-we-do",
      tone: "page",
      title: "What we do",
      lede: "Three business areas, from household electricity to billing platforms for other suppliers.",
      features: [
        {
          icon: House,
          title: "Consumer",
          text: "Electricity, mobile and smart home services for families across Norway, Sweden and Finland, through brands people already know.",
          link: { label: "Explore consumer brands", href: "#consumer" },
        },
        {
          icon: Buildings,
          title: "Business",
          text: "Power agreements, hedging and energy advice for companies of every size, from the corner bakery to industrial groups.",
          link: { label: "Explore business services", href: "#business" },
        },
        {
          icon: Lightning,
          title: "Technology & billing",
          text: "Billing, rating and customer platforms that run millions of invoices a year, for our own brands and for partners.",
          link: { label: "Explore Elmera IT", href: "#it" },
        },
      ],
    },
    {
      _tag: "Closing",
      id: "careers",
      tone: "soft",
      title: "Work with us",
      lede: "900 colleagues across Norway, Sweden and Finland work on our brands, billing platforms and customer care.",
      actions: [
        { label: "See open positions", href: "#positions" },
        { label: "Life at Elmera", href: "#life" },
      ],
    },
  ],
} as const satisfies Site;
