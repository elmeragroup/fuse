/**
 * Server-visible namespace for `ListDetail`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  ListDetailRoot,
  ListDetailList,
  ListDetailDetail,
  ListDetailTitle,
  ListDetailClose,
} from "./list-detail";

export const ListDetail = {
  Root: ListDetailRoot,
  List: ListDetailList,
  Detail: ListDetailDetail,
  Title: ListDetailTitle,
  Close: ListDetailClose,
};
