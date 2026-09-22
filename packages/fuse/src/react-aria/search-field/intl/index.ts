import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * SearchField's dictionary. It owns the `searchField.clear` row, the clear button's
 * default accessible name.
 */
export const searchFieldStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
