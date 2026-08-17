// Renderiza cualquier plantilla de internal/html/ con datos dummy para verla
// en el navegador. Uso: node scripts/preview.mjs reminder && open scripts/preview.html
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dirs = ["internal/html", "internal/b2b/salesOrder/html"];
const name = process.argv[2];

const templates = dirs.flatMap((dir) =>
  fs
    .readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith(".html"))
    .map((f) => ({ name: f.replace(/\.html$/, ""), file: path.join(root, dir, f) })),
);

const template = templates.find((t) => t.name === name);
if (!template) {
  console.error(
    `Uso: node scripts/preview.mjs <template>\n\n${templates.map((t) => t.name).join("\n")}`,
  );
  process.exit(1);
}

const dataUri = (file) =>
  `data:image/png;base64,${fs
    .readFileSync(path.join(root, "assets", file))
    .toString("base64")}`;

// Valores genéricos por token; cualquier {{token}} sin entrada queda visible
// como [[token]] para detectar placeholders sin rellenar.
const values = {
  year: String(new Date().getFullYear()),
  gymName: process.argv[3] || "Gimnasio de Prueba",
  userName: "Camila Rojas",
  planName: "Plan Mensual Full",
  expiryDate: "20-08-2026",
  logoImg: "",
  // La invitación a la app ya no usa CID: recibe el logo armado desde el
  // servicio, así que el preview lo reproduce con el asset local.
  dashcoreLogoImg: `<img src="${dataUri("dashcore-logo.png")}" alt="DashCore" width="180" style="display:block; margin:0 auto 12px; width:180px; height:auto;">`,
};

let html = fs.readFileSync(template.file, "utf8");
html = html.replace(/\{\{#if[^}]*\}\}|\{\{\/if\}\}/g, "");
html = html.replace(/\{\{(\w+)\}\}/g, (_, token) =>
  token in values ? values[token] : `[[${token}]]`,
);
html = html.replaceAll(
  "cid:dashcore_logo_light",
  dataUri("dashcore-logo-light.png"),
);
html = html.replaceAll("cid:dashcore_logo", dataUri("dashcore-logo.png"));

const out = path.join(root, "scripts/preview.html");
fs.writeFileSync(out, html);
console.log(out);
