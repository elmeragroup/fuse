import { writeGeneratedIcons } from "../src/icons/generate";
import { packageRootFromScript } from "./paths";

writeGeneratedIcons(packageRootFromScript(import.meta.url));
