import type { ReactElement } from "react";

import Link from "next/link";

import type { BlockFile } from "../../../../components/block-code";
import { BlockPreview } from "../../../../components/block-preview";
import { DocsCodeBlock } from "../../../../components/docs-code-block";
import { DocsLede } from "../../../../components/docs-lede";
import { pageMetadata } from "../../../../components/docs-page";
import { DocsPageTitle } from "../../../../components/docs-page-title";
import { DocsProse } from "../../../../components/docs-prose";
import { demoSourceHref, readDemoSource } from "../../../../lib/demo-source";
import { componentHref, requireStaticPage } from "../../../../lib/pages";
import { BLOCK_FILES, TABLE_INSTALL_COMMAND } from "./block-files";

const HREF = "/blocks/app-shell";

/** The block's standalone route, which the preview frames and each page extends. */
const PREVIEW = "/blocks/app-shell/preview";

export const metadata = pageMetadata(HREF);

/** The Fuse parts the block composes, each linked to its page. */
const PARTS = [
  ["sidebar", "Sidebar"],
  ["breadcrumb", "Breadcrumb"],
  ["command", "Command"],
  ["dropdown-menu", "DropdownMenu"],
  ["avatar", "Avatar"],
  ["card", "Card"],
  ["frame", "Frame"],
  ["bar-chart", "BarChart"],
  ["line-chart", "LineChart"],
  ["chart", "Chart"],
  ["sparkline", "Sparkline"],
  ["timeline-list", "TimelineList"],
  ["data-table", "DataTable"],
  ["data-table-filter", "DataTableFilter"],
  ["badge", "Badge"],
  ["sheet", "Sheet"],
  ["description-list", "DescriptionList"],
  ["table", "Table"],
  ["toggle-group", "ToggleGroup"],
  ["field", "Field"],
  ["text-field", "TextField"],
  ["select-field", "SelectField"],
  ["radio-group", "RadioGroup"],
  ["switch", "Switch"],
  ["toast", "Toast"],
] as const;

const STYLES_SOURCE = `/* app/globals.css: the quick start's Fuse setup, and the charts' own stylesheet */
@import "tailwindcss";
@import "@elmeragroup/fuse/css";
@import "@elmeragroup/fuse/themes.css";
@import "@elmeragroup/fuse/chart.css";
@source "../node_modules/@elmeragroup/fuse";`;

const LAYOUT_SOURCE = `// app/(app)/layout.tsx
import { AppShell } from "./_block/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}`;

const PAGE_SOURCE = `// app/(app)/metering-points/page.tsx
import { MeteringPointsPage } from "../_block/metering-points-page";

export default function Page() {
  return <MeteringPointsPage />;
}`;

export default function AppShellBlockPage(): ReactElement {
  const page = requireStaticPage(HREF);
  const files: BlockFile[] = BLOCK_FILES.map(({ file, folder }) => {
    const location = { section: "blocks", slug: "app-shell", file } as const;
    return {
      file,
      folder,
      sourceText: readDemoSource(location).source,
      sourceHref: demoSourceHref(location),
    };
  });

  return (
    // The docs shell lays this route out wide (isWidePage), so the preview has room for a desktop
    // layout; the prose keeps its own measure.
    <div className="flex flex-col gap-10">
      <div className="max-w-[720px]">
        <DocsPageTitle>{page.label}</DocsPageTitle>
        <DocsLede>{page.description}</DocsLede>
        <DocsProse className="mt-5">
          <p>
            The back office of a Nordic power retailer, built from Fuse parts and nothing else. It has four
            pages, each at its own address: an overview of the portfolio, the metering points, the
            month&apos;s invoices and the settings. Every number in it is power data, seeded so it reads the
            same on every visit, on Oslo&apos;s clock. Try the sidebar, press ⌘K or Ctrl+K inside the preview,
            filter the table and open an invoice.
          </p>
        </DocsProse>
      </div>

      <BlockPreview title="App shell" src={PREVIEW} folder="app-shell" files={files} />

      <div className="max-w-[720px]">
        <DocsProse>
          <h2 id="what-it-shows">What it shows</h2>
          <ul>
            <li>
              <strong>The shell.</strong> A Sidebar that groups the pages and collapses to icons on desktop
              and turns into a Sheet on a phone, a header with a breadcrumb, a command menu that goes to every
              page and runs the app&apos;s actions, and a user menu. A skip link leads past both to the page.
            </li>
            <li>
              <strong>Overview.</strong> Four key figures with Sparklines, the month&apos;s consumption
              against last year, today&apos;s spot price by the quarter-hour against its 30-day average, a
              year of consumption against solar production, and the latest activity. Each chart plays its
              entrance the first time it comes into view and carries its data as a table.
            </li>
            <li>
              <strong>Metering points.</strong> A DataTable of 480 points with a search, a DataTableFilter
              bar, sorting, pages, a Sparkline per row and a bulk action on the selected rows.
            </li>
            <li>
              <strong>Invoices.</strong> February&apos;s invoices by status, with a Sheet for each one&apos;s
              lines and VAT.
            </li>
            <li>
              <strong>Settings.</strong> A native form whose controls Fuse&apos;s Field wires to their labels,
              descriptions and errors. Save parses the whole draft: a field that does not parse shows why, and
              a draft that parses saves in one step, with a toast.
            </li>
          </ul>

          <h2 id="parts">The parts it uses</h2>
          <p>
            {PARTS.map(([slug, name], index) => (
              <span key={slug}>
                {index === 0 ? null : ", "}
                <Link href={componentHref(slug)}>{name}</Link>
              </span>
            ))}
            .
          </p>

          <h2 id="copy-it">Copy it into your app</h2>
          <p>
            The block imports React, Next&apos;s <code>Link</code> and router hooks, TanStack Table and
            Fuse&apos;s public entries, and nothing else. Start from the{" "}
            <Link href="/quick-start">quick start</Link>, which installs Fuse. TanStack Table is an optional
            peer of Fuse, so install it beside Fuse for the Metering points and Invoices tables:
          </p>
          <DocsCodeBlock source={TABLE_INSTALL_COMMAND} />
          <p>
            Import the charts&apos; stylesheet beside the quick start&apos;s styles: the charts draw their
            layout, colours and screen-reader text from it.
          </p>
          <DocsCodeBlock source={STYLES_SOURCE} />
          <p>
            Copy the files in the Code view into a folder of your app, such as <code>app/(app)/_block</code>,
            and set <code>APP_BASE</code> in <code>app-config.ts</code> to where the app lives, or to{" "}
            <code>&quot;&quot;</code> when it is the whole site. Then mount the shell in the layout that wraps
            the pages, and give each page a route:
          </p>
          <DocsCodeBlock source={LAYOUT_SOURCE} />
          <DocsCodeBlock source={PAGE_SOURCE} />
          <p>
            Replace <code>power-data.ts</code> with your API. The pages read nothing else, and its types say
            what each one needs.
          </p>
        </DocsProse>
      </div>
    </div>
  );
}
