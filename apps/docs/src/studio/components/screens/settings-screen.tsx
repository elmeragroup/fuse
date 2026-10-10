"use client";

import { useRef, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Button } from "@elmeragroup/fuse/button";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { Field } from "@elmeragroup/fuse/field";
import { Heading } from "@elmeragroup/fuse/heading";
import { Gear } from "@elmeragroup/fuse/icons";
import { Item } from "@elmeragroup/fuse/item";
import { Switch } from "@elmeragroup/fuse/switch";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Text } from "@elmeragroup/fuse/text";
import { TextField } from "@elmeragroup/fuse/text-field";
import { Toast } from "@elmeragroup/fuse/toast";

const settingsScreen = tv({
  slots: {
    // Tall enough to hold the dialog, which is fixed to the artboard and adds no height.
    root: "min-h-180 p-8",
    body: "flex flex-col gap-6",
    head: "flex items-center justify-between gap-4",
    panel: "flex flex-col gap-4 pt-4",
    danger: "flex flex-col items-start gap-3 pt-4",
  },
});

const styles = settingsScreen();

const TEAMS = [
  { name: "Customer service", members: "14 members" },
  { name: "Field operations", members: "9 members" },
  { name: "Billing", members: "6 members" },
] as const;

/** The workspace's saved settings, which the dialog edits as a draft. */
type WorkspaceSettings = {
  readonly name: string;
  readonly invite: boolean;
  readonly twoStep: boolean;
  readonly summary: boolean;
  readonly exports: boolean;
  readonly news: boolean;
};

type Toggle = Exclude<keyof WorkspaceSettings, "name">;

const SAVED: WorkspaceSettings = {
  name: "Operations",
  invite: true,
  twoStep: false,
  summary: true,
  exports: true,
  news: false,
};

const GENERAL: readonly { key: Toggle; label: string }[] = [
  { key: "invite", label: "Members can invite others" },
  { key: "twoStep", label: "Require two-step sign-in" },
];

const NOTIFICATIONS: readonly { key: Toggle; label: string }[] = [
  { key: "summary", label: "Weekly summary by email" },
  { key: "exports", label: "A message when an export is ready" },
  { key: "news", label: "Product news" },
];

/** One labelled Switch over a draft setting, label after the control. */
function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <Field.Root orientation="horizontal">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <Field.Label>{label}</Field.Label>
    </Field.Root>
  );
}

/**
 * The overview and its settings dialog. The dialog edits a draft held here, above its tabs, so
 * an edit survives switching tabs, which unmounts the panel it was made in. Save commits the
 * draft and confirms with a toast; Cancel, the close button or Escape discard it. Deleting the
 * workspace, once confirmed, closes the dialog with a toast.
 */
function Workspace(): ReactElement {
  const toasts = Toast.useToastManager();
  const [saved, setSaved] = useState(SAVED);
  const [draft, setDraft] = useState(SAVED);
  const [open, setOpen] = useState(true);
  const popup = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);

  const toggle = (key: Toggle) => (checked: boolean) => {
    setDraft({ ...draft, [key]: checked });
  };
  const switches = (rows: readonly { key: Toggle; label: string }[]) =>
    rows.map(({ key, label }) => (
      <SwitchRow key={key} label={label} checked={draft[key]} onCheckedChange={toggle(key)} />
    ));

  return (
    <div ref={screen} className={styles.body()}>
      <div className={styles.head()}>
        <div>
          <Heading level={2} size="xl">
            {`${saved.name} workspace`}
          </Heading>
          <Text variant="muted" size="sm">
            29 members in 3 teams
          </Text>
        </div>
        <Dialog.Root
          open={open}
          onOpenChange={(next, details) => {
            // The dialog is not modal, so the studio around it stays in use. Escape pressed
            // outside this screen, such as to clear a selection on the canvas, is not the
            // dialog's: it stays open and the key travels on.
            const target = details.event.target;
            const inScreen =
              target instanceof Node &&
              (popup.current?.contains(target) === true || screen.current?.contains(target) === true);
            if (!next && details.reason === "escape-key" && !inScreen) {
              details.cancel();
              details.allowPropagation();
              return;
            }
            // Every opening starts from the saved settings; closing without Save discards.
            setDraft(saved);
            setOpen(next);
          }}
          modal={false}
          disablePointerDismissal>
          <Dialog.Trigger render={<Button variant="outline" />}>
            <Gear data-icon="inline-start" aria-hidden />
            Settings
          </Dialog.Trigger>
          {/* Opening with the page moves no focus, so it does not pull the camera. */}
          <Dialog.Content ref={popup} initialFocus={false}>
            <Dialog.Header>
              <Dialog.Title>Workspace settings</Dialog.Title>
              <Dialog.Description>Changes apply to everyone in the workspace.</Dialog.Description>
            </Dialog.Header>
            <Tabs.Root defaultValue="general">
              <Tabs.List>
                <Tabs.Trigger value="general">General</Tabs.Trigger>
                <Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
                <Tabs.Trigger value="danger">Danger zone</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="general">
                <div className={styles.panel()}>
                  <TextField
                    label="Workspace name"
                    value={draft.name}
                    onChange={(name) => {
                      setDraft({ ...draft, name });
                    }}
                  />
                  {switches(GENERAL)}
                </div>
              </Tabs.Content>
              <Tabs.Content value="notifications">
                <div className={styles.panel()}>{switches(NOTIFICATIONS)}</div>
              </Tabs.Content>
              <Tabs.Content value="danger">
                <div className={styles.danger()}>
                  <Text size="sm">Deleting the workspace removes its teams, exports and history.</Text>
                  <AlertDialog.Root>
                    <AlertDialog.Trigger render={<Button variant="destructive" />}>
                      Delete workspace
                    </AlertDialog.Trigger>
                    <AlertDialog.Content
                      title={`Delete the ${saved.name} workspace?`}
                      actionLabel="Delete workspace"
                      isAutomaticallyCloseOnActionEnabled
                      onAction={() => {
                        setDraft(saved);
                        setOpen(false);
                        toasts.add({ type: "success", title: `The ${saved.name} workspace was deleted.` });
                      }}>
                      This permanently removes the workspace for all 29 members and cannot be undone.
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                </div>
              </Tabs.Content>
            </Tabs.Root>
            <Dialog.Footer>
              <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
              <Button
                onClick={() => {
                  setSaved(draft);
                  setOpen(false);
                  toasts.add({ type: "success", title: "Settings saved" });
                }}>
                Save changes
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </div>
      <Item.Group>
        {TEAMS.map((team) => (
          <Item.Root key={team.name} variant="outline">
            <Item.Content>
              <Item.Title>{team.name}</Item.Title>
              <Item.Description>{team.members}</Item.Description>
            </Item.Content>
          </Item.Root>
        ))}
      </Item.Group>
    </div>
  );
}

/**
 * A workspace's settings, open in a Dialog over its overview: tabs of switches and fields, and
 * a destructive action behind a confirmation. The dialog opens with the page and is not modal,
 * so the rest of the studio stays usable. Escape within the screen, Cancel or its close button discard
 * the draft, Save keeps it, and the Settings button opens it again.
 */
export function SettingsScreen(): ReactElement {
  return (
    <div className={styles.root()}>
      <Toast.Provider>
        <Workspace />
        <Toast.Viewport />
      </Toast.Provider>
    </div>
  );
}
