import { describe, expect, it } from "vitest";

import { Accordion as publishedAccordion } from "./components/accordion";
import { Accordion as clientAccordion } from "./components/accordion/accordion";
import { AlertDialog as publishedAlertDialog } from "./components/alert-dialog";
import { AlertDialog as clientAlertDialog } from "./components/alert-dialog/alert-dialog";
import { Avatar as publishedAvatar } from "./components/avatar";
import { Avatar as clientAvatar } from "./components/avatar/avatar";
import { Breadcrumb as publishedBreadcrumb } from "./components/breadcrumb";
import { Breadcrumb as clientBreadcrumb } from "./components/breadcrumb/breadcrumb";
import { ButtonGroup as publishedButtonGroup } from "./components/button-group";
import { ButtonGroup as clientButtonGroup } from "./components/button-group/button-group";
import { Collapsible as publishedCollapsible } from "./components/collapsible";
import { Collapsible as clientCollapsible } from "./components/collapsible/collapsible";
import { Combobox as publishedCombobox } from "./components/combobox";
import { Combobox as clientCombobox } from "./components/combobox/combobox";
import { Dialog as publishedDialog } from "./components/dialog";
import { Dialog as clientDialog } from "./components/dialog/dialog";
import { DropdownMenu as publishedDropdownMenu } from "./components/dropdown-menu";
import { DropdownMenu as clientDropdownMenu } from "./components/dropdown-menu/dropdown-menu";
import { Field as publishedField } from "./components/field";
import { Field as clientField } from "./components/field/field";
import { InputGroup as publishedInputGroup } from "./components/input-group";
import { InputGroup as clientInputGroup } from "./components/input-group/input-group";
import { Item as publishedItem } from "./components/item";
import { Item as clientItem } from "./components/item/item";
import { Pagination as publishedPagination } from "./components/pagination";
import { Pagination as clientPagination } from "./components/pagination/pagination";
import { Popover as publishedPopover } from "./components/popover";
import { Popover as clientPopover } from "./components/popover/popover";
import { ScrollArea as publishedScrollArea } from "./components/scroll-area";
import { ScrollArea as clientScrollArea } from "./components/scroll-area/scroll-area";
import { Select as publishedSelect } from "./components/select";
import { Select as clientSelect } from "./components/select/select";
import { SelectionItem as publishedSelectionItem } from "./components/selection-item";
import { SelectionItem as clientSelectionItem } from "./components/selection-item/selection-item";
import { Sheet as publishedSheet } from "./components/sheet";
import { Sheet as clientSheet } from "./components/sheet/sheet";
import { Sidebar as publishedSidebar } from "./components/sidebar";
import { Sidebar as clientSidebar } from "./components/sidebar/sidebar";
import { Tabs as publishedTabs } from "./components/tabs";
import { Tabs as clientTabs } from "./components/tabs/tabs";
import { Toast as publishedToast } from "./components/toast";
import { Toast as clientToast } from "./components/toast/toast";
import { ToggleGroup as publishedToggleGroup } from "./components/toggle-group";
import { ToggleGroup as clientToggleGroup } from "./components/toggle-group/toggle-group";
import { Tooltip as publishedTooltip } from "./components/tooltip";
import { Tooltip as clientTooltip } from "./components/tooltip/tooltip";

/**
 * The published object is the unit under test. The client module's object is the
 * oracle: browser tests and client callers import that one, and each published
 * part must be the same function.
 */
const NAMESPACES = [
  ["Accordion", publishedAccordion, clientAccordion],
  ["AlertDialog", publishedAlertDialog, clientAlertDialog],
  ["Avatar", publishedAvatar, clientAvatar],
  ["Breadcrumb", publishedBreadcrumb, clientBreadcrumb],
  ["ButtonGroup", publishedButtonGroup, clientButtonGroup],
  ["Collapsible", publishedCollapsible, clientCollapsible],
  ["Combobox", publishedCombobox, clientCombobox],
  ["Dialog", publishedDialog, clientDialog],
  ["DropdownMenu", publishedDropdownMenu, clientDropdownMenu],
  ["Field", publishedField, clientField],
  ["InputGroup", publishedInputGroup, clientInputGroup],
  ["Item", publishedItem, clientItem],
  ["Pagination", publishedPagination, clientPagination],
  ["Popover", publishedPopover, clientPopover],
  ["ScrollArea", publishedScrollArea, clientScrollArea],
  ["Select", publishedSelect, clientSelect],
  ["SelectionItem", publishedSelectionItem, clientSelectionItem],
  ["Sheet", publishedSheet, clientSheet],
  ["Sidebar", publishedSidebar, clientSidebar],
  ["Tabs", publishedTabs, clientTabs],
  ["Toast", publishedToast, clientToast],
  ["ToggleGroup", publishedToggleGroup, clientToggleGroup],
  ["Tooltip", publishedTooltip, clientTooltip],
] as const;

function byName(left: string, right: string): number {
  return left.localeCompare(right);
}

describe("published namespace parts", () => {
  it.each(NAMESPACES)("%s reproduces the client module's part functions", (_name, published, client) => {
    const publishedParts = new Map(Object.entries(published));
    const clientParts = new Map(Object.entries(client));
    expect([...clientParts.keys()].toSorted(byName)).toEqual([...publishedParts.keys()].toSorted(byName));
    for (const [key, part] of publishedParts) {
      expect(clientParts.get(key)).toBe(part);
    }
  });
});
