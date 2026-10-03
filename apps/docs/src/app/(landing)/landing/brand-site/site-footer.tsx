import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import type { Site, SiteLink } from "./site-model";

const siteFooter = tv({
  slots: {
    // The brand's deepest ink in light mode. Fuse's dark sheets turn `secondary` into a light
    // text tone, so in dark mode the footer sits on the deep soft surface under a rule.
    footer:
      "landing-dark:border-t landing-dark:border-border landing-dark:bg-card-soft landing-dark:text-card-soft-foreground bg-secondary text-secondary-foreground",
    inner:
      "max-w-6xl @3xl:flex-row @3xl:items-start @3xl:justify-between @3xl:px-10 mx-auto flex w-full flex-col gap-8 px-5 py-12",
    name: "text-xl font-semibold font-heading",
    domain: "text-sm opacity-75",
    links: "@xl:grid-cols-3 m-0 grid list-none grid-cols-2 gap-x-10 gap-y-1 p-0",
    link: "text-sm inline-flex min-h-8 items-center rounded-sm text-current/85 no-underline outline-none hover:text-current hover:underline focus-visible:ring-2 focus-visible:ring-ring",
    legal: "text-xs max-w-6xl @3xl:px-10 mx-auto w-full border-t border-current/15 px-5 py-5 opacity-75",
  },
});

const styles = siteFooter();

/** Every place the nav leads: a menu's own links, and the plain links. */
function footerLinks(site: Site): readonly SiteLink[] {
  return site.header.nav.items.flatMap((item): readonly SiteLink[] =>
    item._tag === "Menu" ? item.links : [{ label: item.label, href: item.href }]
  );
}

/** The site's footer: its owner, the nav's destinations and the copyright line. */
export function SiteFooter({ site }: { site: Site }): ReactElement {
  return (
    <footer className={styles.footer()}>
      <div className={styles.inner()}>
        <div>
          <p className={styles.name()}>{site.name}</p>
          <p className={styles.domain()}>{site.domain}</p>
        </div>
        <nav aria-label={site.name}>
          <ul className={styles.links()}>
            {footerLinks(site).map((link) => (
              <li key={link.href}>
                <a href={link.href} className={styles.link()}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className={styles.legal()}>{`© 2026 ${site.name}`}</p>
    </footer>
  );
}
