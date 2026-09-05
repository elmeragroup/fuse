import { flagAssets } from "@elmeragroup/ui/flags";

const assets = new Map(Object.entries(flagAssets));
const select = document.createElement("select");
select.id = "country-choice";
select.setAttribute("aria-label", "Country");
for (const country of Object.keys(flagAssets)) {
  select.add(new Option(country, country));
}
select.value = "NO";
const image = document.createElement("img");
image.id = "flag";
image.width = 20;
image.height = 15;
const url = assets.get(select.value);
if (url === undefined) throw new Error("Missing flag URL");
image.src = url;
select.addEventListener("change", () => {
  const url = assets.get(select.value);
  if (url === undefined) throw new Error("Missing flag URL");
  image.src = url;
});
document.body.append(select, image);
