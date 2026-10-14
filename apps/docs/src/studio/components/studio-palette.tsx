"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { SitePaletteProvider, useSiteCommands } from "../../components/site-palette/site-palette";
import { colorSchemeOptions } from "../../components/site-palette/site-palette-model";
import type {
  SiteCommand,
  SiteSettings,
  SiteShortcut,
} from "../../components/site-palette/site-palette-model";
import { useModifierKey } from "../../lib/modifier-key";
import { useCornerXraySwitch } from "./corner-xray";
import { useStudioEdits } from "./studio-edits";
import { usePartSelection } from "./studio-part-selection";
import { studioToasts } from "./studio-persistence";
import { useStudio } from "./studio-state";
import { TOOLS } from "./studio-toolbar";

/** The studio's one setting: the editor chrome's scheme, which the top bar's switch also moves. */
function useStudioSettings(): SiteSettings {
  const { chromeScheme, setChromeScheme } = useStudio();
  return useMemo(
    (): SiteSettings => ({
      pages: [
        {
          id: "chrome-scheme",
          label: "Chrome scheme",
          keywords: ["appearance", "editor", "color scheme"],
          options: colorSchemeOptions(chromeScheme, setChromeScheme),
        },
      ],
      commands: [],
    }),
    [chromeScheme, setChromeScheme]
  );
}

/**
 * The studio's site palette around the editor. Its toasts are the studio's own, which wear the
 * chrome's theme.
 */
export function StudioPalette({ children }: { children: ReactNode }): ReactElement {
  return (
    <SitePaletteProvider settings={useStudioSettings()} toasts={studioToasts}>
      {children}
    </SitePaletteProvider>
  );
}

/** A single-key canvas shortcut, which the canvas takes outside text fields and open overlays. */
function letter(key: string): SiteShortcut {
  return { keys: [key], aria: key };
}

/**
 * Adds the canvas toolbar's commands to the palette: undo and redo, the tools and Select part, and
 * the corner X-ray on a page that offers it. Each shows the shortcut the studio binds for it.
 */
export function StudioToolbarCommands(): null {
  const { setTool } = useStudio();
  const { partMode, setPartMode } = usePartSelection();
  const { edit, canUndo, canRedo } = useStudioEdits();
  const { available: xrayAvailable, active: xrayActive, setOn: setXray } = useCornerXraySwitch();
  const modifier = useModifierKey();
  useSiteCommands(
    useMemo((): readonly SiteCommand[] => {
      const commands: SiteCommand[] = [
        {
          id: "undo",
          title: "Undo",
          disabled: !canUndo,
          shortcut: { keys: [modifier, "Z"], aria: "Meta+Z Control+Z" },
          action: {
            _tag: "Run",
            run: () => {
              edit({ type: "undo" });
            },
          },
        },
        {
          id: "redo",
          title: "Redo",
          disabled: !canRedo,
          shortcut: { keys: ["⇧", modifier, "Z"], aria: "Shift+Meta+Z Shift+Control+Z" },
          action: {
            _tag: "Run",
            run: () => {
              edit({ type: "redo" });
            },
          },
        },
        ...TOOLS.map(({ value, label, key, keywords }): SiteCommand => ({
          id: `${value}-tool`,
          title: `${label} tool`,
          keywords,
          shortcut: letter(key),
          action: {
            _tag: "Run",
            run: () => {
              setTool(value);
            },
          },
        })),
        {
          id: "select-part",
          title: "Select part",
          shortcut: letter("P"),
          action: {
            _tag: "Run",
            run: () => {
              setPartMode(!partMode);
            },
          },
        },
      ];
      if (xrayAvailable) {
        commands.push({
          id: "corner-xray",
          title: "Corner X-ray",
          shortcut: letter("X"),
          action: {
            _tag: "Run",
            run: () => {
              setXray(!xrayActive);
            },
          },
        });
      }
      return commands;
    }, [canUndo, canRedo, modifier, edit, setTool, partMode, setPartMode, xrayAvailable, xrayActive, setXray])
  );
  return null;
}
