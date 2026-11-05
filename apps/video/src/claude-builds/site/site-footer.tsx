import type { ReactElement } from "react";

import { Link } from "@elmeragroup/fuse/link";
import { Text } from "@elmeragroup/fuse/text";
import { BRANDS } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { BrandWordmark } from "../../brand/brand-wordmark";
import { useCopy } from "../../copy/copy";

/**
 * The site's footer on the brand's soft tint: the logo, three columns of Fuse links, which
 * underline under the pointer as a footer's rows do, and the legal line with the brand's name.
 *
 * @param props.brand - The brand the site wears.
 * @returns The footer, filling its section.
 */
export function SiteFooter({ brand }: { readonly brand: BrandCode }): ReactElement {
  const { footer } = useCopy().claudeBuilds.site;
  return (
    <footer className="flex h-full flex-col justify-between bg-primary-soft px-10 pt-12 pb-6 text-primary-soft-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,10rem)] gap-8">
        <BrandWordmark brand={brand} />
        {footer.columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{column.title}</span>
            {column.links.map((link) => (
              <Link key={link} href={`#${link}`} underline="hover" className="text-sm text-current/85">
                {link}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <Text className="text-xs m-0 border-t border-current/15 pt-4 opacity-85">
        {footer.legal(BRANDS[brand].displayName)}
      </Text>
    </footer>
  );
}
