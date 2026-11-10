import type { ReactElement } from "react";

const SERVER_ENTRY = `// instrumentation.ts (Next.js), or your server's entry module: before anything renders.
import "@elmeragroup/fuse/temporal-polyfill";`;

const CLIENT_ENTRY = `// app/providers.tsx: the client module that mounts your providers.
"use client";

import "@elmeragroup/fuse/temporal-polyfill";

import { LocaleProvider } from "@elmeragroup/fuse/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      {children}
    </LocaleProvider>
  );
}`;

/** Installing Temporal: where the opt-in entry goes, what it patches, the warning and the exit. */
export function InstallSection(): ReactElement {
  return (
    <>
      <h2 id="install-temporal">Install Temporal</h2>
      <p>
        Fuse never installs Temporal on its own: it reads <code>globalThis.Temporal</code>. Import the opt-in
        entry once in every runtime that renders a date component, before any of them renders: the server
        entry and the client module that mounts your providers.
      </p>
      <pre>
        <code>{SERVER_ENTRY}</code>
      </pre>
      <pre>
        <code>{CLIENT_ENTRY}</code>
      </pre>
      <ul>
        <li>
          <strong>What it patches.</strong> Only where the engine has no <code>Temporal</code>: it installs{" "}
          <code>temporal-polyfill</code> on <code>globalThis</code>, replaces <code>Intl.DateTimeFormat</code>{" "}
          with the polyfill&apos;s (which formats Temporal values) and adds{" "}
          <code>Date.prototype.toTemporalInstant</code>.
        </li>
        <li>
          <strong>What it leaves.</strong> A native Temporal, or one your host installed first, stays in place
          along with the native <code>Intl.DateTimeFormat</code>. The root <code>@elmeragroup/fuse</code>{" "}
          entry never imports it; the package lists it in <code>sideEffects</code>, so a bare import survives
          tree-shaking.
        </li>
        <li>
          <strong>The warning.</strong> In development, the first date component to render warns once when the
          entry was never imported, also in an engine that has Temporal, so you find out in Chromium before
          Safari throws. Without any Temporal, the component throws a <code>TypeError</code> naming the entry.
        </li>
        <li>
          <strong>TypeScript.</strong> Fuse&apos;s declarations name the global <code>Temporal</code> types,
          which come from TypeScript&apos;s own lib, not from the polyfill. Type-check with TypeScript 6.0 or
          later and a <code>lib</code> that includes <code>esnext</code> (or <code>esnext.temporal</code>).
          With an older compiler or lib, Fuse&apos;s declarations report{" "}
          <code>Cannot find namespace &apos;Temporal&apos;</code>, or, under <code>skipLibCheck</code>, the
          date props are typed <code>any</code>.
        </li>
        <li>
          <strong>Node.</strong> Node 24 has no Temporal, so server rendering needs the import there; Node 26
          ships it.
        </li>
        <li>
          <strong>Exit.</strong> Once stable Safari on macOS and iOS and every Node LTS Fuse supports ship
          Temporal, the entry stops installing and only silences the warning; the next major removes it.
        </li>
      </ul>
    </>
  );
}
