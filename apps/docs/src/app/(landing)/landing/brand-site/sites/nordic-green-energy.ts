import type { Site } from "../site-model";

/**
 * Nordic Green Energy's home-customer site in Finnish, after the nordicgreen.fi reference. It
 * carries only the reference's header, hero and footer.
 */
export const NORDIC_GREEN_ENERGY_SITE = {
  brand: "ngfi",
  name: "Nordic Green Energy",
  domain: "nordicgreen.fi",
  locale: "fi-FI",
  headings: "center",
  logo: "wordmark",
  caption: "Nordic Green Energy's public website, built with Fuse",
  header: {
    layout: "stacked",
    segments: {
      label: "Asiakastyyppi",
      items: [
        { label: "Kotiin", href: "#kotiin" },
        { label: "Yritykselle", href: "#yritykselle" },
      ],
    },
    utility: [
      { label: "Asiakaspalvelu", href: "#asiakaspalvelu" },
      { label: "Tietoa meistä", href: "#tietoa-meista" },
      { label: "Energianeuvonta", href: "#energianeuvonta" },
    ],
    nav: {
      label: "Päävalikko",
      items: [
        { _tag: "Link", label: "Tee sopimus", href: "#tee-sopimus" },
        { _tag: "Link", label: "Sähkösopimukset", href: "#sahkosopimukset" },
        { _tag: "Link", label: "Mobiilisovellus", href: "#mobiilisovellus" },
        { _tag: "Link", label: "Aurinkopaneelit ja akut", href: "#aurinkopaneelit" },
        { _tag: "Link", label: "Ilmalämpöpumput", href: "#ilmalampopumput" },
      ],
    },
    cta: { label: "Lataa sovellus", href: "#lataa-sovellus" },
    signIn: { label: "Kirjaudu", href: "#kirjaudu" },
    menu: "Valikko",
  },
  hero: {
    layout: "panel",
    title: "Tee uusi sähkösopimus kotiisi jo tänään",
    lede: "Autamme sinua sähkönkulutuksen hallinnassa, jotta voit keskittyä arjessa tärkeisiin asioihin. Tutustu vaihtoehtoihin ja valitse kotiisi sopiva sähkösopimus.",
    actions: [
      { label: "Tee sopimus kotiin", href: "#tee-sopimus" },
      { label: "Yritykselle", href: "#yritykselle" },
    ],
    image: {
      src: "/landing/sites/ngfi/hero.webp",
      alt: "Kaksi oranssia syksyn lehteä vaaleanvihreällä pohjalla. Lehtiin on leikattu hinnat: kuukausimaksut 2,99 €/kk ja marginaali 0,48 snt/kWh + spot, 10 kuukautta.",
      width: 1200,
      height: 1200,
    },
  },
  sections: [],
} as const satisfies Site;
