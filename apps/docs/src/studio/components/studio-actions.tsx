"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Button } from "@elmeragroup/fuse/button";
import { Code } from "@elmeragroup/fuse/code";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Copy, DotsThree } from "@elmeragroup/fuse/icons";

import { useSiteCommands } from "../../components/site-palette/site-palette";
import type { SiteCommand } from "../../components/site-palette/site-palette-model";
import { copyWithToast } from "../../lib/copy-with-toast";
import type { StudioDocument } from "../lib/edits";
import { exportCss } from "../lib/export-css";
import { encodeShare } from "../lib/share-codec";
import { declarationsOf } from "../lib/token-values";
import { useStudioEdits } from "./studio-edits";
import { studioToasts, toastUnshareable } from "./studio-persistence";
import { useStudio } from "./studio-state";

const studioActions = tv({
  slots: {
    desktop: "hidden items-center gap-1 lg:flex",
    phone: "lg:hidden",
    code: "max-h-96 rounded-md border border-border bg-muted p-3",
  },
});

const styles = studioActions();

function hasEdits(document: StudioDocument): boolean {
  const { light, dark, shared, density } = document.overrides;
  return [light, dark, shared, density?.dense ?? {}, density?.comfortable ?? {}].some(
    (group) => Object.keys(group).length > 0
  );
}

/** Copies the address that opens the studio on `document`, or says why it cannot. */
function copyShareLink(document: StudioDocument): void {
  const encoded = encodeShare(document);
  if (!encoded.ok) {
    toastUnshareable(encoded.reason);
    return;
  }
  const url = new URL(window.location.href);
  url.hash = encoded.text;
  void copyWithToast(studioToasts, url.toString(), "Link copied");
}

/**
 * The top bar's session actions: copy a share link, export the edits as CSS, and reset every
 * edit after a confirmation. On a phone they sit in one menu. The site palette lists the same
 * three; its Export and Reset all open these dialogs once the palette has closed.
 */
export function StudioActions(): ReactElement {
  const { theme } = useStudio();
  const { overrides, seed, edit } = useStudioEdits();
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const document = useMemo((): StudioDocument => ({ theme, overrides }), [theme, overrides]);
  const edited = hasEdits(document);
  const css = seed === undefined ? undefined : exportCss(document, declarationsOf(seed));
  const exportable = css !== undefined;

  const copyLink = () => {
    copyShareLink(document);
  };

  useSiteCommands(
    useMemo(
      (): readonly SiteCommand[] => [
        {
          id: "copy-link",
          title: "Copy link",
          keywords: ["share"],
          action: {
            _tag: "Run",
            run: () => {
              copyShareLink(document);
            },
          },
        },
        {
          id: "export-css",
          title: "Export CSS",
          disabled: !exportable,
          action: {
            _tag: "OpenOverlay",
            open: () => {
              setExporting(true);
            },
          },
        },
        {
          id: "reset-all",
          title: "Reset all",
          disabled: !edited,
          action: {
            _tag: "OpenOverlay",
            open: () => {
              setResetting(true);
            },
          },
        },
      ],
      [document, exportable, edited]
    )
  );

  return (
    <>
      <div className={styles.desktop()}>
        <Button variant="ghost" size="sm" onClick={copyLink}>
          Copy link
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={css === undefined}
          onClick={() => {
            setExporting(true);
          }}>
          Export
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!edited}
          onClick={() => {
            setResetting(true);
          }}>
          Reset all
        </Button>
      </div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          render={
            <Button variant="ghost" size="icon-sm" className={styles.phone()} aria-label="Theme actions" />
          }>
          <DotsThree />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item onClick={copyLink}>Copy link</DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={css === undefined}
            onClick={() => {
              setExporting(true);
            }}>
            Export
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!edited}
            onClick={() => {
              setResetting(true);
            }}>
            Reset all
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <Dialog.Root open={exporting} onOpenChange={setExporting}>
        <Dialog.Content size="xl">
          <Dialog.Header>
            <Dialog.Title>Export CSS</Dialog.Title>
            <Dialog.Description>
              Paste it after the Fuse stylesheet. It holds the tokens you edited and the aliases that read
              them.
            </Dialog.Description>
          </Dialog.Header>
          <Code code={css ?? ""} aria-label="Exported CSS" className={styles.code()} />
          <Dialog.Footer showCloseButton>
            <Button
              onClick={() => {
                void copyWithToast(studioToasts, css ?? "", "CSS copied");
              }}>
              <Copy data-icon="inline-start" />
              Copy CSS
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
      <AlertDialog.Root open={resetting} onOpenChange={setResetting}>
        <AlertDialog.Content
          title="Reset every edit?"
          actionLabel="Reset all"
          onAction={() => {
            edit({ type: "reset-all" });
            setResetting(false);
          }}>
          Every token returns to the base theme&apos;s value in both schemes, and every density metric to
          Fuse&apos;s. Undo brings the edits back.
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
