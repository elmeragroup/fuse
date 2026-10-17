import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Combobox } from "@elmeragroup/fuse/combobox";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Copy, Download } from "@elmeragroup/fuse/icons";
import { Popover } from "@elmeragroup/fuse/popover";
import { Select } from "@elmeragroup/fuse/select";
import { Skeleton } from "@elmeragroup/fuse/skeleton";
import { useTheme } from "@elmeragroup/fuse/theme";
import { Toolbar } from "@elmeragroup/fuse/toolbar";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { priceAreasOf } from "../../../brand/brand-market";
import { useCopy, useVideoLocale } from "../../../copy/copy";
import { FrameToast } from "../../../motion/frame-toast";
import { METER_NUMBER, READING_KWH } from "../../../sample/customer-data";
import { PlateOverlay, usePlateMotion } from "./plate";

/** A confirmation over a page the scrim dims, centred on its plate. */
export function DialogTile(): ReactElement {
  const { dialog } = useCopy().brandBook.collage;
  return (
    <>
      <PagePlaceholder />
      <PlateOverlay>
        {({ open, container }) => (
          <Dialog.Root open={open}>
            <Dialog.Content
              container={container}
              initialFocus={false}
              finalFocus={false}
              showCloseButton={false}
              className="w-[calc(100%-2rem)] gap-4 p-5">
              <Dialog.Header>
                <Dialog.Title>{dialog.title}</Dialog.Title>
                <Dialog.Description>{dialog.description}</Dialog.Description>
              </Dialog.Header>
              <Dialog.Footer>
                <Button variant="outline">{dialog.cancel}</Button>
                <Button>{dialog.confirm}</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        )}
      </PlateOverlay>
    </>
  );
}

/** A price-area picker in its plate's market, open under its trigger. */
export function SelectTile(): ReactElement {
  const { select } = useCopy().brandBook.collage;
  const { areas, picked } = priceAreasOf(useTheme().brand);
  return (
    <div className="flex h-full flex-col gap-2 pt-1">
      <span className="text-sm font-medium">{select.label}</span>
      <PlateOverlay>
        {({ open, container }) => (
          <Select.Root items={areas} value={picked} open={open}>
            <Select.Trigger aria-label={select.label} className="w-full">
              <Select.Value />
            </Select.Trigger>
            {/* The plate's transform is the popup's containing block, where Fuse documents item
                alignment as unsupported; the popup opens under its trigger. */}
            <Select.Content container={container} alignItemWithTrigger={false} finalFocus={false}>
              {Object.entries(areas).map(([value, label]) => (
                <Select.Item key={value} value={value}>
                  {label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        )}
      </PlateOverlay>
    </div>
  );
}

/** An actions menu, open under its trigger, with a destructive last item. */
export function DropdownMenuTile(): ReactElement {
  const { menu } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full flex-col items-start pt-1">
      <PlateOverlay>
        {({ open, container }) => (
          <DropdownMenu.Root open={open}>
            <DropdownMenu.Trigger render={<Button variant="outline" />}>{menu.trigger}</DropdownMenu.Trigger>
            <DropdownMenu.Content container={container} finalFocus={false} className="w-56">
              {menu.items.map((item) => (
                <DropdownMenu.Item key={item}>{item}</DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator />
              <DropdownMenu.Item variant="destructive">{menu.destructive}</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </PlateOverlay>
    </div>
  );
}

/** A popover that explains a setting, open under its trigger. */
export function PopoverTile(): ReactElement {
  const { popover } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full flex-col items-start pt-1">
      <PlateOverlay>
        {({ open, container }) => (
          <Popover.Root open={open}>
            <Popover.Trigger render={<Button variant="outline" />}>{popover.trigger}</Popover.Trigger>
            <Popover.Content
              container={container}
              align="start"
              initialFocus={false}
              finalFocus={false}
              className="w-64">
              <Popover.Header>
                <Popover.Title>{popover.title}</Popover.Title>
                <Popover.Description>{popover.description}</Popover.Description>
              </Popover.Header>
            </Popover.Content>
          </Popover.Root>
        )}
      </PlateOverlay>
    </div>
  );
}

/** A toolbar of invoice actions, its download button showing its tooltip. */
export function ToolbarTile(): ReactElement {
  const { tooltip, toolbar } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full items-end pb-2">
      <Tooltip.Provider>
        <Toolbar.Root aria-label={toolbar.label}>
          <Toolbar.Button render={<Button variant="ghost" size="sm" />}>
            <Copy data-icon="inline-start" aria-hidden />
            {toolbar.duplicate}
          </Toolbar.Button>
          <Toolbar.Separator />
          <PlateOverlay>
            {({ open, container }) => (
              <Tooltip.Root open={open}>
                <Tooltip.Trigger
                  render={
                    <Toolbar.Button render={<Button variant="ghost" size="icon" aria-label={tooltip} />} />
                  }>
                  <Download aria-hidden />
                </Tooltip.Trigger>
                <Tooltip.Content container={container}>{tooltip}</Tooltip.Content>
              </Tooltip.Root>
            )}
          </PlateOverlay>
        </Toolbar.Root>
      </Tooltip.Provider>
    </div>
  );
}

/** Municipalities in TrøndelagKraft's region and beyond, the combobox's choices. */
const MUNICIPALITIES = ["Bergen", "Bodø", "Oslo", "Tromsø", "Trondheim", "Ålesund"] as const;

/**
 * A combobox filtering as its query reads. It holds no chosen value: Base UI highlights a chosen
 * item when the list opens, not when it mounts open, so a frame would differ with its history.
 */
export function ComboboxTile(): ReactElement {
  const { combobox } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full flex-col gap-2 pt-1">
      <span className="text-sm font-medium">{combobox.label}</span>
      <PlateOverlay>
        {({ open, container }) => (
          <Combobox.Root items={[...MUNICIPALITIES]} open={open} inputValue="Tr">
            <Combobox.Input aria-label={combobox.label} />
            <Combobox.Content container={container} initialFocus={false} finalFocus={false}>
              <Combobox.Empty />
              <Combobox.List>
                <Combobox.Collection>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.Collection>
              </Combobox.List>
            </Combobox.Content>
          </Combobox.Root>
        )}
      </PlateOverlay>
    </div>
  );
}

/** A success toast that slides in once its plate is in view. */
export function ToastTile(): ReactElement {
  const { toast } = useCopy().brandBook.collage;
  const locale = useVideoLocale();
  const { clock, window: span } = usePlateMotion();
  return (
    <div className="relative h-full">
      <PagePlaceholder />
      <FrameToast
        at={span?.openAt ?? Number.POSITIVE_INFINITY}
        clock={clock}
        title={toast.title}
        description={toast.description(new Intl.NumberFormat(locale).format(READING_KWH), METER_NUMBER)}
        // Fuse places the viewport with `sm:` classes too; the stage's viewport is wider than `sm`.
        className="sm:inset-x-0 sm:bottom-0 sm:w-full absolute inset-x-0 bottom-0 w-full"
      />
    </div>
  );
}

/** The faint page a modal plate dims: a heading and a few lines, drawn as skeleton bars. */
function PagePlaceholder(): ReactElement {
  return (
    <div aria-hidden className="flex h-full flex-col gap-3 pt-2">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
