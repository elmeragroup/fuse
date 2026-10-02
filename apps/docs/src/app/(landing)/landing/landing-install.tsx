"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Toast } from "@elmeragroup/fuse/toast";

import { INSTALL_COMMAND } from "../../../lib/docs-model";
import { BrandHeatmap } from "./brand-heatmap";
import { BROWSE_COMPONENTS, QUICK_START } from "./landing-facts";
import { useLandingTheme } from "./landing-theme";

const COPIED_MS = 1600;

const landingInstall = tv({
  slots: {
    section:
      "relative isolate grid min-h-140 grid-cols-1 overflow-hidden border-t border-border lg:grid-cols-2",
    copy: "sm:px-6 relative z-10 flex flex-col justify-center gap-6 px-4 pt-16 lg:py-24 lg:pr-0 lg:pl-20",
    title: "text-5xl sm:text-landing-h2 tracking-landing-hero font-semibold font-heading",
    lede: "text-base sm:text-lg leading-relaxed max-w-125 text-pretty text-muted-foreground",
    command:
      "text-sm flex h-(--control-h-lg) w-full max-w-110 items-center gap-3 rounded-(--radius-button) border border-border bg-card pr-1.5 pl-4 font-mono text-card-foreground",
    commandText: "min-w-0 flex-1 truncate select-all",
    links: "flex flex-wrap gap-x-6 gap-y-2",
    stage: "relative h-90 lg:h-auto",
    // Fades the shader's grain into the copy column on wide screens, and into the copy above on phones.
    fade: "pointer-events-none absolute inset-x-0 top-0 h-30 bg-linear-to-b from-background to-transparent lg:inset-y-0 lg:right-auto lg:h-auto lg:w-60 lg:bg-linear-to-r",
  },
});

const styles = landingInstall();

function InstallCommand(): ReactElement {
  const toastManager = Toast.useToastManager();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copy() {
    try {
      // Throws too where there is no clipboard at all, as on insecure origins.
      await navigator.clipboard.writeText(INSTALL_COMMAND);
    } catch {
      toastManager.add({
        type: "error",
        title: "Could not copy",
        description: `Select the command to copy it: ${INSTALL_COMMAND}`,
      });
      return;
    }
    setCopied(true);
    toastManager.add({ type: "success", title: "Copied to clipboard", description: INSTALL_COMMAND });
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <div className={styles.command()}>
      <code className={styles.commandText()}>{INSTALL_COMMAND}</code>
      <Button size="sm" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function LandingInstall(): ReactElement {
  const { theme } = useLandingTheme();

  return (
    <section className={styles.section()} aria-labelledby="landing-install">
      <div className={styles.copy()}>
        <h2 id="landing-install" className={styles.title()}>
          Install Fuse.
        </h2>
        <p className={styles.lede()}>
          One package and one stylesheet. Use it with Tailwind or as standalone CSS.
        </p>
        <InstallCommand />
        <div className={styles.links()}>
          <Button variant="link" render={<Link href={QUICK_START.href} />} nativeButton={false}>
            Read the quick start ›
          </Button>
          <Button variant="link" render={<Link href={BROWSE_COMPONENTS.href} />} nativeButton={false}>
            Browse components ›
          </Button>
        </div>
      </div>
      <div className={styles.stage()}>
        <BrandHeatmap brand={theme.brand} />
        <div aria-hidden className={styles.fade()} />
      </div>
    </section>
  );
}
