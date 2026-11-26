/**
 * Server module. Renders every public namespace part of the compound components whose
 * implementation is `"use client"`, plus Alert, SelectField, AutocompleteField, ComboboxField,
 * DateField, DatePickerField, DateRangePickerField, AspectRatio and TimelineList.
 *
 * The part lists are the public namespace shape. They are not read from the
 * implementation: a missing or renamed part fails here even if the source still parses.
 *
 * Oracle: React Flight (`createClientModuleProxy`, which the sibling loader installs for
 * `"use client"` modules). Dotting into a client module throws "Cannot access X.Y on the
 * server". A directive-free namespace object is a real object, so each client part is a
 * client reference the server may pass through; the lists name the few directive-free
 * markup parts, which must stay server components. Alert's composed tree must render on
 * the server: the warning root is a div row (`data-slot` item, `role` alert), not a
 * client reference.
 */
import { createElement } from "react";
import type { ComponentType, ReactElement } from "react";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { ActionBar } from "@elmeragroup/fuse/action-bar";
import { Alert } from "@elmeragroup/fuse/alert";
import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";
import { Attachment } from "@elmeragroup/fuse/attachment";
import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { AutocompleteField } from "@elmeragroup/fuse/autocomplete-field";
import { Avatar } from "@elmeragroup/fuse/avatar";
import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";
import { Calendar } from "@elmeragroup/fuse/calendar";
import { Card } from "@elmeragroup/fuse/card";
import { Carousel } from "@elmeragroup/fuse/carousel";
import { CheckboxItem } from "@elmeragroup/fuse/checkbox";
import { Collapsible } from "@elmeragroup/fuse/collapsible";
import { Combobox } from "@elmeragroup/fuse/combobox";
import { ComboboxField } from "@elmeragroup/fuse/combobox-field";
import { Command } from "@elmeragroup/fuse/command";
import { CommandVirtual } from "@elmeragroup/fuse/command-virtual";
import { DataTable } from "@elmeragroup/fuse/data-table";
import { DataTableFilter } from "@elmeragroup/fuse/data-table-filter";
import { DateField, DateInput } from "@elmeragroup/fuse/date-field";
import { DatePicker, DatePickerField } from "@elmeragroup/fuse/date-picker";
import { DateRangePicker, DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Field } from "@elmeragroup/fuse/field";
import { FileUpload } from "@elmeragroup/fuse/file-upload";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Item } from "@elmeragroup/fuse/item";
import { ListDetail } from "@elmeragroup/fuse/list-detail";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
import { Pagination } from "@elmeragroup/fuse/pagination";
import { Popover } from "@elmeragroup/fuse/popover";
import { RadioItem } from "@elmeragroup/fuse/radio-group";
import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { Sidebar } from "@elmeragroup/fuse/sidebar";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";
import { Toast } from "@elmeragroup/fuse/toast";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Toolbar } from "@elmeragroup/fuse/toolbar";
import { Tooltip } from "@elmeragroup/fuse/tooltip";
import { Tour } from "@elmeragroup/fuse/tour";

import { flightElements, flightModels } from "./rsc-flight-payload.ts";
import type { FlightJson, FlightObject } from "./rsc-flight-payload.ts";
import { renderFlight } from "./rsc-flight-server.ts";

const ALERT_PARTS = ["Root", "Icon", "Title", "Description"] as const;

function byName(left: string, right: string): number {
  return left.localeCompare(right);
}

const CLIENT_REFERENCE = Symbol.for("react.client.reference");

/** A client function that is not a component, such as Toast's manager hook and factory. */
type ClientHelper = () => object;

/** A namespace member as its public type declares it. */
type NamespacePart = ComponentType<never> | ClientHelper;

/**
 * A Flight client reference: the server serializes it instead of running it.
 * Reading `$$typeof` and `$$id` on a client-module proxy is allowed.
 */
function isClientReference(part: NamespacePart): boolean {
  return "$$typeof" in part && part.$$typeof === CLIENT_REFERENCE && "$$id" in part;
}

/** Handwritten parts that are not client components. */
type OtherParts<Server extends string, Helper extends string> = {
  /** Directive-free markup components. The server runs them, so they must not be client references. */
  readonly server?: readonly Server[];
  /** Client functions that are not components (Toast's manager hook and factory). Checked, not rendered. */
  readonly helpers?: readonly Helper[];
};

function unexpectedParts(name: string, problem: string, parts: readonly string[]): void {
  if (parts.length > 0) {
    throw new Error(`${name} parts ${problem}: ${parts.join(", ")}`);
  }
}

/**
 * Check a namespace against its handwritten part lists. Client components and helpers must be
 * Flight client references; server components must not be.
 */
function checkNamespace<Client extends string, Server extends string = never, Helper extends string = never>(
  name: string,
  namespace: Readonly<Record<NoInfer<Client | Server>, ComponentType<never>>> &
    Readonly<Record<NoInfer<Helper>, ClientHelper>>,
  client: readonly Client[],
  { server = [], helpers = [] }: OtherParts<Server, Helper> = {}
): void {
  // Read each part before comparing keys. On a client-module object this throws
  // "Cannot access X.Y on the server" instead of reporting an empty key list.
  const references: readonly (Client | Helper)[] = [...client, ...helpers];
  unexpectedParts(
    name,
    "are not client references",
    references.filter((part) => !isClientReference(namespace[part]))
  );
  unexpectedParts(
    name,
    "are client references but should render on the server",
    server.filter((part) => isClientReference(namespace[part]))
  );
  const actual = Object.keys(namespace).toSorted(byName);
  const expected = [...references, ...server].toSorted(byName);
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(`${name} parts\nactual: ${actual.join(", ")}\nexpected: ${expected.join(", ")}`);
  }
}

/** Check a namespace as {@link checkNamespace} does, then render its components with no props. */
function renderNamespace<Client extends string, Server extends string = never, Helper extends string = never>(
  name: string,
  namespace: Readonly<Record<NoInfer<Client | Server>, ComponentType<never>>> &
    Readonly<Record<NoInfer<Helper>, ClientHelper>>,
  client: readonly Client[],
  other: OtherParts<Server, Helper> = {}
): ReactElement[] {
  checkNamespace(name, namespace, client, other);
  const components: readonly (Client | Server)[] = [...client, ...(other.server ?? [])];
  return components.map((part) => createElement(namespace[part]));
}

function namespaceElements(): ReactElement[] {
  return [
    ...renderNamespace("Accordion", Accordion, ["Root", "Item", "Header", "Trigger", "Content"]),
    ...renderNamespace("ActionBar", ActionBar, [
      "Root",
      "Count",
      "Clear",
      "Button",
      "ButtonLabel",
      "Separator",
    ]),
    ...renderNamespace("AlertDialog", AlertDialog, ["Root", "Trigger", "Content"]),
    ...renderNamespace("Attachment", Attachment, ["Root", "Group", "Action", "Trigger"], {
      server: ["Media", "AspectRatio", "Content", "Title", "Description", "Actions"],
    }),
    ...renderNamespace("Autocomplete", Autocomplete, [
      "Root",
      "Input",
      "Trigger",
      "Clear",
      "Content",
      "List",
      "Item",
      "Group",
      "Label",
      "Collection",
      "Empty",
      "Status",
      "Separator",
    ]),
    ...renderNamespace("Avatar", Avatar, ["Root", "Group", "Image", "Fallback"]),
    ...renderNamespace("Breadcrumb", Breadcrumb, [
      "Root",
      "List",
      "Item",
      "Link",
      "Page",
      "Separator",
      "Ellipsis",
    ]),
    ...renderNamespace("ButtonGroup", ButtonGroup, ["Root", "Separator", "Text"]),
    ...renderNamespace("Calendar", Calendar, [
      "Root",
      "Header",
      "DecrementMonth",
      "IncrementMonth",
      "VisibleRangeHeading",
      "Months",
      "Month",
      "MonthHeading",
      "DayGrid",
      "DayGridHeader",
      "DayGridHeaderRow",
      "DayGridHeaderCell",
      "DayGridBody",
      "DayGridRow",
      "DayGridCell",
      "DayButton",
    ]),
    ...renderNamespace("Card", Card, ["SectionButton"], {
      server: [
        "Root",
        "Header",
        "Tag",
        "Title",
        "Description",
        "Action",
        "Content",
        "Footer",
        "Section",
        "SectionMedia",
      ],
    }),
    ...renderNamespace("Carousel", Carousel, [
      "Root",
      "Viewport",
      "Slide",
      "Controls",
      "Previous",
      "Next",
      "Indicators",
      "Indicator",
      "Status",
      "Autoplay",
    ]),
    ...renderNamespace("Collapsible", Collapsible, ["Root", "Trigger", "Content"]),
    ...renderNamespace("Combobox", Combobox, [
      "Root",
      "Input",
      "Trigger",
      "Clear",
      "Content",
      "List",
      "Item",
      "Group",
      "Label",
      "Collection",
      "Empty",
      "Separator",
      "Chips",
      "Chip",
      "ChipsInput",
      "Value",
    ]),
    ...renderNamespace(
      "Command",
      Command,
      [
        "Root",
        "Trigger",
        "Content",
        "Input",
        "Back",
        "List",
        "Empty",
        "Status",
        "Group",
        "Label",
        "Collection",
        "Item",
        "Page",
        "PageTrigger",
        "NavigateHint",
        "SelectHint",
        "CloseHint",
        "BackHint",
      ],
      { server: ["Shortcut", "Footer", "Hint"] }
    ),
    ...renderNamespace("CommandVirtual", CommandVirtual, ["List"]),
    ...renderNamespace("DataTable", DataTable, [
      "Content",
      "Header",
      "Body",
      "Row",
      "Pagination",
      "SortButton",
      "ResizeHandle",
      "ColumnToggle",
      "SelectAll",
      "SelectRow",
      "RowActions",
      "Text",
      "Number",
      "Date",
      "DateTime",
      "Currency",
    ]),
    ...renderNamespace("DataTableFilter", DataTableFilter, [
      "Root",
      "Bar",
      "Trigger",
      "Chips",
      "Chip",
      "Subject",
      "Operator",
      "Value",
      "Remove",
      "Clear",
      "Content",
      "FieldList",
      "ValueContent",
      "Editor",
      "OptionEditor",
      "TextEditor",
      "NumberEditor",
      "DateEditor",
      "ValuesFooter",
      "SelectAllValues",
      "ClearValues",
      "Done",
    ]),
    ...renderNamespace("Dialog", Dialog, [
      "Root",
      "Trigger",
      "Portal",
      "Close",
      "Overlay",
      "Content",
      "Header",
      "Footer",
      "Title",
      "Description",
    ]),
    ...renderNamespace("DropdownMenu", DropdownMenu, [
      "Root",
      "Trigger",
      "Portal",
      "Content",
      "Group",
      "Label",
      "Item",
      "LinkItem",
      "CheckboxItem",
      "RadioGroup",
      "RadioItem",
      "Separator",
      "Shortcut",
      "Sub",
      "SubTrigger",
      "SubContent",
    ]),
    ...renderNamespace("Field", Field, [
      "Root",
      "Label",
      "Description",
      "Error",
      "Control",
      "Item",
      "Content",
      "Group",
      "Set",
      "Legend",
      "Separator",
      "Title",
    ]),
    ...renderNamespace("FileUpload", FileUpload, ["Root", "Dropzone", "Trigger", "Description"]),
    ...renderNamespace("InputGroup", InputGroup, ["Root", "Addon", "Button", "Text", "Input", "Textarea"]),
    ...renderNamespace("Item", Item, ["Root", "Group", "Separator"], {
      server: ["Media", "Content", "Actions", "Title", "Description", "Header", "Footer"],
    }),
    ...renderNamespace("ListDetail", ListDetail, ["Root", "List", "Detail", "Title", "Close"]),
    ...renderNamespace("NavigationMenu", NavigationMenu, [
      "Root",
      "List",
      "Item",
      "Trigger",
      "Content",
      "Link",
      "Viewport",
      "Indicator",
    ]),
    ...renderNamespace("Pagination", Pagination, [
      "Root",
      "Content",
      "Item",
      "Link",
      "Previous",
      "Next",
      "Ellipsis",
    ]),
    ...renderNamespace("DateInput", DateInput, ["Root", "Segment"]),
    ...renderNamespace("DatePicker", DatePicker, [
      "Root",
      "Group",
      "Input",
      "Trigger",
      "Popup",
      "Calendar",
      "TimeInput",
      "Presets",
      "PresetItem",
    ]),
    ...renderNamespace("DateRangePicker", DateRangePicker, [
      "Root",
      "Label",
      "Group",
      "StartInput",
      "Separator",
      "EndInput",
      "Trigger",
      "Error",
      "Description",
      "Popup",
      "Calendar",
      "StartTimeInput",
      "EndTimeInput",
      "Presets",
      "PresetItem",
    ]),
    ...renderNamespace("Popover", Popover, ["Root", "Trigger", "Content", "Header", "Title", "Description"]),
    ...renderNamespace("RangeCalendar", RangeCalendar, [
      "Root",
      "Header",
      "DecrementMonth",
      "IncrementMonth",
      "VisibleRangeHeading",
      "Months",
      "Month",
      "MonthHeading",
      "DayGrid",
      "DayGridHeader",
      "DayGridHeaderRow",
      "DayGridHeaderCell",
      "DayGridBody",
      "DayGridRow",
      "DayGridCell",
      "DayButton",
    ]),
    ...renderNamespace("ScrollArea", ScrollArea, ["Root", "Viewport", "Bar"]),
    ...renderNamespace("Select", Select, [
      "Root",
      "Trigger",
      "Value",
      "Content",
      "Item",
      "Group",
      "Label",
      "Separator",
      "ScrollUpButton",
      "ScrollDownButton",
    ]),
    // SubSection is a server part (see `partitionSubSections`).
    ...renderNamespace("SelectionItem", SelectionItem, ["Shell", "Title", "Actions"], {
      server: ["Description", "Content", "SubSection"],
    }),
    ...renderNamespace("Sheet", Sheet, [
      "Root",
      "Trigger",
      "Close",
      "Portal",
      "Overlay",
      "Content",
      "Header",
      "Body",
      "Footer",
      "Title",
      "Description",
    ]),
    ...renderNamespace("Sidebar", Sidebar, [
      "Provider",
      "Root",
      "Trigger",
      "Rail",
      "Inset",
      "Input",
      "Header",
      "Footer",
      "Separator",
      "Content",
      "Group",
      "GroupLabel",
      "GroupAction",
      "GroupContent",
      "Menu",
      "MenuItem",
      "MenuButton",
      "MenuAction",
      "MenuBadge",
      "MenuSkeleton",
      "MenuSub",
      "MenuSubItem",
      "MenuSubButton",
      "Icon",
    ]),
    ...renderNamespace("Tabs", Tabs, ["Root", "List", "Trigger", "Content"]),
    ...renderNamespace(
      "Toast",
      Toast,
      ["Provider", "Viewport", "Root", "Content", "Title", "Description", "Action", "Close"],
      { helpers: ["useToastManager", "createToastManager"] }
    ),
    ...renderNamespace("ToggleGroup", ToggleGroup, ["Root", "Item"]),
    ...renderNamespace("Toolbar", Toolbar, ["Root", "Button", "Link", "Input", "Group", "Separator"]),
    ...renderNamespace("Tooltip", Tooltip, ["Provider", "Root", "Trigger", "Content"]),
    ...renderNamespace("Tour", Tour, [
      "Provider",
      "Target",
      "Beacon",
      "Popup",
      "Header",
      "Progress",
      "Close",
      "Spotlight",
      "Ring",
      "Title",
      "Description",
      "Footer",
      "Skip",
      "Prev",
      "Next",
    ]),
  ];
}

function alertTree(): ReactElement {
  const actual = Object.keys(Alert).toSorted(byName);
  const expected = [...ALERT_PARTS].toSorted(byName);
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(`Alert parts\nactual: ${actual.join(", ")}\nexpected: ${expected.join(", ")}`);
  }
  return createElement(
    "section",
    { "data-fixture": "alert" },
    createElement(Alert.Icon, { variant: "warning" }),
    createElement(
      Alert.Root,
      { variant: "warning" },
      createElement(Alert.Title, null, "Sync delayed"),
      createElement(Alert.Description, null, "Facility data is more than an hour old.")
    )
  );
}

const CHECKBOX_BAND = "Includes a price-freeze guarantee.";
const RADIO_BAND = "Price follows the hourly market.";

/** CheckboxItem and RadioItem are hook-free rows; the server runs them and reads their parts. */
function selectionItemTrees(): ReactElement {
  const rows: readonly (readonly [string, NamespacePart])[] = [
    ["CheckboxItem", CheckboxItem],
    ["RadioItem", RadioItem],
  ];
  for (const [name, row] of rows) {
    if (isClientReference(row)) {
      throw new Error(`${name} is a client reference; the server must run it to read its parts`);
    }
  }
  return createElement(
    "section",
    { "data-fixture": "selection-items" },
    createElement(
      CheckboxItem,
      { value: "fixed" },
      createElement(
        CheckboxItem.Content,
        null,
        createElement(CheckboxItem.Title, null, "Fixed price"),
        createElement(CheckboxItem.Description, null, "Locked for 12 months.")
      ),
      createElement(CheckboxItem.Actions, null, "Recommended"),
      createElement(CheckboxItem.SubSection, null, CHECKBOX_BAND)
    ),
    createElement(
      RadioItem,
      { value: "spot" },
      createElement(RadioItem.Content, null, createElement(RadioItem.Title, null, "Spot price")),
      createElement(RadioItem.SubSection, null, RADIO_BAND)
    )
  );
}

/**
 * AspectRatio and Attachment's markup parts hold no state, so the server runs them, here inside
 * the client Attachment.Root.
 */
function attachmentTree(): ReactElement {
  if (isClientReference(AspectRatio)) {
    throw new Error("AspectRatio is a client reference; the server must run it");
  }
  return createElement(
    "section",
    { "data-fixture": "attachment" },
    createElement(AspectRatio, { ratio: "16:9" }, "Site photo"),
    createElement(
      Attachment.Root,
      { orientation: "vertical" },
      createElement(
        Attachment.Media,
        { variant: "image" },
        createElement(Attachment.AspectRatio, { ratio: "3:4" }, "Meter photo")
      ),
      createElement(
        Attachment.Content,
        null,
        createElement(Attachment.Title, null, "meter.jpg"),
        createElement(Attachment.Description, null, "JPEG · 1.2 MB")
      )
    )
  );
}

const TIMELINE_STATUS_LABEL = "Delivered on time";

/**
 * TimelineList's parts are directive-free markup, so the server runs them. `Time` needs a `date`,
 * so the parts render in a list of their own rather than bare. An explicit `statusLabel` renders
 * on the server as a native `span`; a dictionary status crosses as a client element.
 */
function timelineListTree(): ReactElement {
  checkNamespace("TimelineList", TimelineList, [], {
    server: ["Root", "Item", "Title", "Time", "Description"],
  });
  return createElement(
    "section",
    { "data-fixture": "timeline-list" },
    createElement(
      TimelineList.Root,
      { layout: "horizontal", indicatorSize: "md" },
      createElement(
        TimelineList.Item,
        { status: "complete", statusLabel: TIMELINE_STATUS_LABEL },
        createElement(TimelineList.Title, null, "Delivered")
      ),
      createElement(
        TimelineList.Item,
        { status: "current" },
        createElement(TimelineList.Title, null, "Invoiced"),
        createElement(TimelineList.Time, { date: "2026-04-01" }, "1 April 2026")
      ),
      createElement(
        TimelineList.Item,
        {
          status: "upcoming",
          opposite: createElement(TimelineList.Time, { date: "2026-04-15" }, "15 April 2026"),
        },
        createElement(TimelineList.Description, null, "Payment due.")
      )
    )
  );
}

const CAROUSEL_OFFERS = ["Spot price this winter", "Fixed price for a year"] as const;

/** A server component: the Flight payload holds its output, not a reference to it. */
function CarouselOffer({ title }: { readonly title: string }): ReactElement {
  return createElement("p", { "data-carousel-offer": title }, title);
}

/**
 * Carousel.Root and its parts are client components that a server tree renders, here around
 * slides whose content is a server component's output.
 */
function carouselTree(): ReactElement {
  return createElement(
    "section",
    { "data-fixture": "carousel" },
    createElement(
      Carousel.Root,
      { "aria-label": "Offers" },
      createElement(
        Carousel.Viewport,
        null,
        ...CAROUSEL_OFFERS.map((title) =>
          createElement(Carousel.Slide, { key: title }, createElement(CarouselOffer, { title }))
        )
      ),
      createElement(
        Carousel.Controls,
        null,
        createElement(Carousel.Previous),
        createElement(Carousel.Indicators),
        createElement(Carousel.Next)
      )
    )
  );
}

/**
 * The date props a composite, run on the server, must not hand its Root when it was given none. A
 * server component passes no date value: React writes a Temporal object as the text its `toJSON`
 * prints, with a warning in development, and every Root refuses text. A page that holds a date
 * hands it to a client component, which builds the value.
 */
const DATE_PROPS = ["value", "defaultValue", "minValue", "maxValue"] as const;

/**
 * A server component renders the whole Calendar without a date value. `Calendar.Months` renders
 * its default months: a function child could not cross to the client.
 */
function calendarTree(): ReactElement {
  return createElement(
    "section",
    { "data-fixture": "calendar" },
    createElement(
      Calendar.Root,
      { "aria-label": "Delivery", visibleMonths: 2 },
      createElement(
        Calendar.Header,
        null,
        createElement(Calendar.DecrementMonth),
        createElement(Calendar.VisibleRangeHeading),
        createElement(Calendar.IncrementMonth)
      ),
      createElement(Calendar.Months)
    )
  );
}

/** A server component renders the whole RangeCalendar without a range, with its default months. */
function rangeCalendarTree(): ReactElement {
  return createElement(
    "section",
    { "data-fixture": "range-calendar" },
    createElement(
      RangeCalendar.Root,
      { "aria-label": "Stay", visibleMonths: 2 },
      createElement(
        RangeCalendar.Header,
        null,
        createElement(RangeCalendar.DecrementMonth),
        createElement(RangeCalendar.VisibleRangeHeading),
        createElement(RangeCalendar.IncrementMonth)
      ),
      createElement(RangeCalendar.Months)
    )
  );
}

/**
 * DateField owns no state, so a server form runs it and hands `DateInput.Root` its props, as a
 * hand-composed `Field.Root` would. Without a value, its granularity and zone name the kind. Its
 * default segments need no function child.
 */
function dateFieldTree(): ReactElement {
  if (isClientReference(DateField)) {
    throw new Error("DateField is a client reference; the server must run it");
  }
  return createElement(
    "section",
    { "data-fixture": "date-field" },
    createElement(DateField, {
      label: "Outage starts",
      name: "outage",
      granularity: "minute",
      hourCycle: 24,
      timeZone: "Europe/Oslo",
    })
  );
}

/**
 * DatePickerField and DateRangePickerField own no state, so a server form runs them and hands the
 * pickers' Roots their props, and a preset pane built of client parts, as nodes. Their calendars'
 * default children need no function child.
 */
function datePickerTrees(): ReactElement {
  for (const [name, composite] of [
    ["DatePickerField", DatePickerField],
    ["DateRangePickerField", DateRangePickerField],
  ] as const) {
    if (isClientReference(composite)) {
      throw new Error(`${name} is a client reference; the server must run it`);
    }
  }
  return createElement(
    "section",
    { "data-fixture": "date-pickers" },
    createElement(DatePickerField, {
      label: "Moving day",
      name: "moving",
      firstDayOfWeek: "mon",
      presetGroup: createElement(
        DatePicker.Presets,
        { value: "first" },
        createElement(DatePicker.PresetItem, { value: "first" }, "First weekday")
      ),
    }),
    createElement(DateRangePickerField, {
      label: "Maintenance window",
      startName: "from",
      endName: "to",
      granularity: "minute",
      hourCycle: 24,
    })
  );
}

const SELECT_FIELD_PLACEHOLDER = "Choose a plan";

/**
 * SelectField owns no state, so a server form runs it and hands its options to the client
 * Select parts, as a hand-composed `Field.Root` around `Select.Root` would.
 */
function selectFieldTree(): ReactElement {
  if (isClientReference(SelectField)) {
    throw new Error("SelectField is a client reference; the server must run it");
  }
  return createElement(
    "section",
    { "data-fixture": "select-field" },
    createElement(
      SelectField,
      { label: "Plan", name: "plan", items: { basic: "Basic" }, placeholder: SELECT_FIELD_PLACEHOLDER },
      createElement(Select.Item, { value: "basic" }, "Basic")
    )
  );
}

const AUTOCOMPLETE_FIELD_PLACEHOLDER = "Type a company";
const COMBOBOX_FIELD_PLACEHOLDER = "Search fruit";

/**
 * AutocompleteField and ComboboxField own no state either, so a server form runs them and hands
 * their popup content to the client parts, as a hand-composed `Field.Root` would.
 */
function labeledComboboxTrees(): ReactElement {
  for (const [name, part] of [
    ["AutocompleteField", AutocompleteField],
    ["ComboboxField", ComboboxField],
  ] as const) {
    if (isClientReference(part)) {
      throw new Error(`${name} is a client reference; the server must run it`);
    }
  }
  return createElement(
    "section",
    { "data-fixture": "labeled-comboboxes" },
    createElement(
      AutocompleteField,
      {
        label: "Company",
        name: "company",
        items: ["Fjellkraft AS"],
        placeholder: AUTOCOMPLETE_FIELD_PLACEHOLDER,
      },
      createElement(
        Autocomplete.List,
        null,
        createElement(Autocomplete.Item, { value: "Fjellkraft AS" }, "Fjellkraft AS")
      )
    ),
    createElement(
      ComboboxField,
      { label: "Fruit", name: "fruit", items: ["Apple"], placeholder: COMBOBOX_FIELD_PLACEHOLDER },
      createElement(Combobox.List, null, createElement(Combobox.Item, { value: "Apple" }, "Apple"))
    )
  );
}

function Fixture(): ReactElement {
  return createElement(
    "div",
    null,
    ...namespaceElements(),
    alertTree(),
    selectionItemTrees(),
    selectFieldTree(),
    labeledComboboxTrees(),
    attachmentTree(),
    timelineListTree(),
    carouselTree(),
    calendarTree(),
    rangeCalendarTree(),
    dateFieldTree(),
    datePickerTrees()
  );
}

const { payload, errors } = await renderFlight(createElement(Fixture));
const [renderError] = errors;
if (renderError !== undefined) {
  throw renderError;
}

if (!payload.includes("Sync delayed") || !payload.includes("Facility data is more than an hour old.")) {
  throw new Error(`Alert text missing from the server payload:\n${payload.slice(0, 1500)}`);
}
// Client parts are module references (`I["…/item.tsx#…"]`). A server-rendered
// Alert root is a div row. Check that row: `selection-item.tsx` contains the
// substring `item.tsx`, so a whole-payload search would not mean Item ran.
const alertRoot = payload
  .split("\n")
  .find((line) => line.includes('data-slot":"item"') && line.includes('"role":"alert"'));
/**
 * The row's className. Flight moves a string of 1024 characters or more into its own text row,
 * `<id>:T<hex length>,<text>`, and writes `"$<id>"` in its place, so a long class list is read
 * from that row.
 */
function classNameOf(row: string): string | undefined {
  const value = /"className":"([^"]*)"/u.exec(row)?.[1];
  const id = value === undefined ? undefined : /^\$([0-9a-f]+)$/u.exec(value)?.[1];
  if (id === undefined) return value;
  const header = new RegExp(`(?:^|\n)${id}:T([0-9a-f]+),`, "u").exec(payload);
  if (header === null) return undefined;
  const start = header.index + header[0].length;
  return payload.slice(start, start + Number.parseInt(header[1] ?? "0", 16));
}
if (
  alertRoot === undefined ||
  !alertRoot.includes('["$","div"') ||
  !(classNameOf(alertRoot) ?? "").includes("bg-warning-soft") ||
  alertRoot.includes("item.tsx") ||
  alertRoot.includes("button.tsx")
) {
  throw new Error(`Alert chrome was not rendered on the server:\n${alertRoot ?? payload.slice(0, 1500)}`);
}
// Button's own module path: other client parts, such as `data-table-sort-button.tsx`, end in
// `button.tsx` too.
if (payload.includes("/components/button/button.tsx")) {
  throw new Error("The no-action Alert rendered a client Button");
}

// Each SubSection crosses Flight as its rendered root, marked for `partitionSubSections`. Where
// each band lands after Flight is `rsc-selection-item.test.ts`'s.
// Every Flight element of the payload, flattened once for the checks below.
const elements = flightModels(payload).flatMap(flightElements);
const bands = elements.filter(({ props }) => "data-selection-item-sub-section" in props);
if (bands.length !== 2) {
  throw new Error(`SubSections were not rendered on the server:\n${JSON.stringify(bands)}`);
}
for (const text of ["Fixed price", "Locked for 12 months.", CHECKBOX_BAND, "Spot price", RADIO_BAND]) {
  if (!payload.includes(text)) {
    throw new Error(`${text} is missing from the server payload`);
  }
}

if (!payload.includes(SELECT_FIELD_PLACEHOLDER)) {
  throw new Error(`SelectField's placeholder is missing from the server payload:\n${payload.slice(0, 1500)}`);
}

for (const placeholder of [AUTOCOMPLETE_FIELD_PLACEHOLDER, COMBOBOX_FIELD_PLACEHOLDER]) {
  if (!payload.includes(placeholder)) {
    throw new Error(
      `A labeled combobox's placeholder is missing from the server payload:\n${payload.slice(0, 1500)}`
    );
  }
}

if (!payload.includes("meter.jpg")) {
  throw new Error(`Attachment's title is missing from the server payload:\n${payload.slice(0, 1500)}`);
}
// The `"div"` type tells a server-rendered Attachment.AspectRatio from a client one, which
// Flight would write as a module reference carrying the same props.
const attachmentFrame = elements.some(
  ({ type, props }) =>
    type === "div" &&
    props["data-slot"] === "attachment-aspect-ratio" &&
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Flight props are parsed JSON, so the JSON type is the only tag a class string has
    typeof props.className === "string" &&
    props.className.split(/\s+/u).includes("aspect-3/4")
);
if (!attachmentFrame) {
  throw new Error(`Attachment.AspectRatio was not rendered on the server:\n${payload.slice(0, 1500)}`);
}

// The Items ran on the server: the root's `ol`, the `li` that `current` marks, the explicit status
// text as a native `span`, and the dictionary text as a client element that carries the status.
const isClientElement = (type: FlightJson | undefined): boolean =>
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a Flight type is parsed JSON, so the JSON type is the only tag it has
  typeof type === "string" && type.startsWith("$L");
const timelineChecks = {
  root: elements.some(({ type, props }) => type === "ol" && props["data-layout"] === "horizontal"),
  current: elements.some(({ type, props }) => type === "li" && props["aria-current"] === "step"),
  label: elements.some(
    ({ type, props }) => type === "span" && props.children === `${TIMELINE_STATUS_LABEL} `
  ),
  dictionary: elements.some(
    ({ type, props }) => isClientElement(type) && props.status === "upcoming" && !("statusLabel" in props)
  ),
};
if (Object.values(timelineChecks).includes(false)) {
  throw new Error(`TimelineList did not render on the server as expected: ${JSON.stringify(timelineChecks)}`);
}

// Each offer is the server component's own `<p>`, and the Root is a client reference.
for (const title of CAROUSEL_OFFERS) {
  const rendered = elements.some(({ type, props }) => type === "p" && props["data-carousel-offer"] === title);
  if (!rendered) {
    throw new Error(`Carousel slide content was not rendered on the server:\n${payload.slice(0, 1500)}`);
  }
}
if (!payload.includes("/components/carousel/carousel.tsx")) {
  throw new Error(`Carousel.Root is not a client reference in the payload:\n${payload.slice(0, 1500)}`);
}

/** Whether a Root's Flight props carry no date prop. */
function withoutDates(props: FlightObject): boolean {
  return DATE_PROPS.every((prop) => !(prop in props));
}

// The Root crosses once, as a client reference.
const calendarRoots = elements.filter(
  ({ props }) => props["aria-label"] === "Delivery" && props.visibleMonths === 2
);
if (calendarRoots.length !== 1) {
  throw new Error(`Calendar.Root did not cross once:\n${payload.slice(0, 1500)}`);
}
if (!payload.includes("/components/calendar/calendar.tsx")) {
  throw new Error(`Calendar.Root is not a client reference in the payload:\n${payload.slice(0, 1500)}`);
}

// The RangeCalendar Root crosses once, as a client reference.
const rangeCalendarRoots = elements.filter(
  ({ props }) => props["aria-label"] === "Stay" && props.visibleMonths === 2
);
if (rangeCalendarRoots.length !== 1) {
  throw new Error(`RangeCalendar.Root did not cross once:\n${payload.slice(0, 1500)}`);
}
if (!payload.includes("/components/range-calendar/range-calendar.tsx")) {
  throw new Error(`RangeCalendar.Root is not a client reference in the payload:\n${payload.slice(0, 1500)}`);
}

// DateField ran on the server: its label is in the payload, and DateInput.Root is a client
// reference that received the granularity and zone, and no date props.
if (!payload.includes("Outage starts")) {
  throw new Error(`DateField's label is missing from the server payload:\n${payload.slice(0, 1500)}`);
}
const dateInputRoots = elements.filter(
  ({ props }) => props.granularity === "minute" && props.timeZone === "Europe/Oslo"
);
if (
  dateInputRoots.length !== 1 ||
  dateInputRoots[0]?.props.hourCycle !== 24 ||
  !withoutDates(dateInputRoots[0].props)
) {
  throw new Error(`DateInput.Root did not cross with DateField's props:\n${payload.slice(0, 1500)}`);
}
if (!payload.includes("/components/date-field/date-input.tsx")) {
  throw new Error(`DateInput.Root is not a client reference in the payload:\n${payload.slice(0, 1500)}`);
}

// The pickers' composites ran on the server: their labels are in the payload, and their Roots are
// client references that received the composites' props, and no date props.
for (const label of ["Moving day", "Maintenance window", "First weekday"]) {
  if (!payload.includes(label)) {
    throw new Error(`"${label}" is missing from the server payload:\n${payload.slice(0, 1500)}`);
  }
}
const datePickerRoots = elements.filter(({ props }) => props.firstDayOfWeek === "mon");
if (datePickerRoots.length !== 1 || !withoutDates(datePickerRoots[0]?.props ?? {})) {
  throw new Error(`DatePicker.Root did not cross with DatePickerField's props:\n${payload.slice(0, 1500)}`);
}
const rangeRoots = elements.filter(({ props }) => props.startName === "from" && props.endName === "to");
if (
  rangeRoots.length !== 1 ||
  rangeRoots[0]?.props.granularity !== "minute" ||
  !withoutDates(rangeRoots[0].props)
) {
  throw new Error(
    `DateRangePicker.Root did not cross with DateRangePickerField's props:\n${payload.slice(0, 1500)}`
  );
}
for (const module of [
  "/components/date-picker/date-picker.tsx",
  "/components/date-range-picker/date-range-picker.tsx",
]) {
  if (!payload.includes(module)) {
    throw new Error(`${module} is not a client reference in the payload:\n${payload.slice(0, 1500)}`);
  }
}

process.stdout.write("RSC_OK\n");
