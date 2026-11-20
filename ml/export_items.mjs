// Writes the catalog items the recommender is trained on (titles + shop products).
import { writeFileSync } from "node:fs";
import { PRODUCTS, TITLES } from "../api/_lib/catalog.js";
const items = [...TITLES.map((t) => ({ key: `title:${t.id}`, kind: "title", type: t.type, genres: t.genres, franchise: t.franchise })),
  ...PRODUCTS.map((p) => ({ key: `product:${p.id}`, kind: "product", type: p.category, genres: [], franchise: p.franchise }))];
writeFileSync(new URL("./items.json", import.meta.url), JSON.stringify({ items }, null, 1));
console.log(items.length, "items");
