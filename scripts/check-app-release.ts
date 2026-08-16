// Chequeo + preview de la plantilla app_release.
// Uso: npx ts-node scripts/check-app-release.ts && open scripts/preview.html
import assert from "assert";
import fs from "fs";
import path from "path";

process.env.RESEND_API_KEY ||= "re_dummy_key_for_preview";
process.env.SENDER_EMAIL ||= "noreply@example.com";

import { composeAppReleaseHtml } from "../internal/service/appRelease";

const html = composeAppReleaseHtml(
  {
    version: "1.4.0",
    title: "Reserva de clases desde la app",
    notes: [
      "Ya podes reservar tu clase y verla en tu calendario",
      "El QR de acceso ahora carga sin conexion",
      "<script>alert(1)</script> queda escapado",
    ],
    appStoreLink: "https://apps.apple.com/cl/app/dashcore-members/id6761695440",
    googlePlayLink:
      "https://play.google.com/store/apps/details?id=cl.dashcore.clientapp",
  },
  "Camila Rojas",
);

assert(!html.includes("{{"), "quedaron placeholders sin reemplazar");
assert(html.includes("1.4.0"), "falta la version");
assert(html.includes("Hola Camila Rojas,"), "falta el saludo con nombre");
assert(
  (html.match(/border-radius:50%/g) ?? []).length >= 3,
  "faltan bullets de notas",
);
assert(!html.includes("<script>alert(1)</script>"), "el HTML no se escapo");
assert(html.includes("&lt;script&gt;"), "el HTML no se escapo");
assert(html.includes("apps.apple.com"), "falta el boton de App Store");
assert(html.includes("play.google.com"), "falta el boton de Google Play");

// Sin links de tienda el bloque de botones desaparece entero, sin dejar el
// titulo huerfano.
const withoutStores = composeAppReleaseHtml(
  { version: "1.4.0", title: "Sin tiendas", notes: ["Una nota"] },
  null,
);
assert(!withoutStores.includes("{{"), "quedaron placeholders sin reemplazar");
assert(withoutStores.includes("Hola,"), "falta el saludo sin nombre");
assert(
  !withoutStores.includes("Actualiza la app</p>"),
  "el bloque de tiendas deberia desaparecer",
);

fs.writeFileSync(path.join(__dirname, "preview.html"), html);
console.log("OK — preview en scripts/preview.html");
