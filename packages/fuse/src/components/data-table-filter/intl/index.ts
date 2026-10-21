import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** The data table filter's own dictionary. Operator rows are keyed `kind.operator`. */
export const dataTableFilterStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });

/** A row of the data table filter's dictionary. */
export type DataTableFilterStringKey = keyof typeof enUS;
