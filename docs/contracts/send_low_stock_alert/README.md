# POST /mail/send_low_stock_alert

## Propósito

Envía una alerta cuando uno o más items (materiales operativos del gimnasio y/o productos de inventario en venta) descienden al o por debajo de su umbral mínimo configurado (`minStockAlert`). El correo va a múltiples destinatarios (admin, bodega, operaciones) y muestra dos secciones diferenciadas: **Materiales** (acento dorado) e **Inventario** (acento rojo). Se dispara desde el backend cuando se actualiza el stock de un item y cruza el umbral.

## Autenticación

- Mecanismo: API Key
- Middleware: `requireApiKey` (`internal/middleware.ts/apiKeyAuth.ts`)
- Comparación en tiempo constante (`crypto.timingSafeEqual`).

## Request

### Headers

| Header | Valor | Requerido |
|---|---|---|
| `Content-Type` | `application/json` | Sí |
| `X-API-Key` | `<MAIL_SERVICE_API_KEY>` | Sí |

### Body

A diferencia de los otros dos reportes, este controller **sí valida exhaustivamente** el payload con una función `validatePayload(body)` antes de enviar (`internal/controllers/lowStockAlert.ts`). Cualquier fallo devuelve `400` con detalles.

```
{
  "to": ["admin@powercavegym.cl", "bodega@powercavegym.cl"],
  "subject": "Alerta de stock bajo - PowerCave",
  "gymName": "PowerCave",
  "logoUrl": "https://cdn.powercave.cl/logos/powercave.jpg",
  "items": [
    { "kind": "material",  "name": "Toallas de papel",     "currentStock": 12, "minStockAlert": 20, "unit": "rollos" },
    { "kind": "inventory", "name": "Batido proteico 30g",  "currentStock": 8,  "minStockAlert": 15, "unit": "unidades" }
  ]
}
```

| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `to` | `string[]` | Sí | **Array de emails** (a diferencia de todos los demás endpoints donde `to` es un string). Debe ser array no vacío. Cada elemento se valida con regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. El servicio envía **un correo por destinatario** secuencialmente (no usa la API multi-`to` de Resend). |
| `subject` | `string` | No | Si no se provee o es `""`, el controller usa default `` `Alerta de stock bajo - ${gymName}` ``. Si se provee debe ser string. |
| `gymName` | `string` | Sí | Truthy, no-empty after trim. Se hace `.trim()` antes de usar. |
| `logoUrl` | `string \| null` | No | Si se provee debe ser **string que empiece con `"https://"`** (validado). `null` o ausente → sin logo (renderiza fallback con iniciales). |
| `items` | `Array<LowStockAlertItem>` | Sí | Array **no vacío**. Mezcla materiales e inventario; el controller los **particiona server-side** por `kind`. |

**`LowStockAlertItem`**:

| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `kind` | `"material" \| "inventory"` | Sí | Debe ser exactamente uno de los dos valores (whitelist `ALLOWED_KINDS`). |
| `name` | `string` | Sí | No vacío después de trim implícito (`name.trim() === ""` falla). Se **escapa HTML** al renderizar. |
| `currentStock` | `number` | Sí | `typeof number`, finito, `>= 0` (cero permitido — out of stock). |
| `minStockAlert` | `number` | Sí | `typeof number`, finito, `> 0` (cero **no** permitido — debe haber un umbral). |
| `unit` | `string?` | No | Opcional. Si se provee debe ser string. Se concatena al stock con un espacio: `${currentStock} ${unit}`. Si es string vacío después de validar, **se descarta** (no se incluye en el item normalizado). |

**Campos NO aceptados en el request** (los calcula el servidor):

- `materialItems`, `inventoryItems`: el cliente manda items mezclados en `items`; el controller particiona por `kind`.
- `hasMaterials`, `hasInventory`: se derivan de `materialItems.length > 0` y `inventoryItems.length > 0`.
- `generatedAt`: se calcula server-side con timezone `America/Santiago`.

Ver `request.json` para ejemplo completo con ambos `kind` y un item sin `unit`.

## Responses

### 200 OK

```json
{ "message": "Low stock alert email sent successfully" }
```

Ver `response.json`.

### 400 Bad Request

Devuelto por `validatePayload`. Forma:

```json
{ "message": "<razón>", "missing": ["to", "gymName"] }
```

(El campo `missing` solo aparece para el error "Missing required fields"; los demás errores devuelven solo `message`.)

Mensajes posibles:

- `"Request body must be a JSON object"` — body ausente o no objeto.
- `"Missing required fields"` — con `missing: ["to" | "gymName" | "items"]`.
- `"Invalid email at to[<i>]"` — email no pasa regex.
- `"subject must be a string when provided"`.
- `"logoUrl must be an https URL when provided"` — no es string o no empieza con `https://`.
- `"items[<i>] must be an object"`.
- `` `items[<i>].kind must be one of: material, inventory` ``.
- `"items[<i>].name is required"`.
- `"items[<i>].currentStock must be a finite number >= 0"`.
- `"items[<i>].minStockAlert must be a finite number > 0"`.
- `"items[<i>].unit must be a string when provided"`.

### 401 / 403

Del middleware `requireApiKey`.

### 500 Internal Server Error

```json
{ "message": "Error sending low stock alert email", "error": "<error.message>" }
```

Solo se alcanza si Resend falla o hay un error en el render (no debería pasar tras la validación).

## Comportamiento

- **Side effects**: ninguno hacia DB. `sendMail` no escribe `mail_logs`.
- **Cálculos en el servidor**:
  - **Particionado de `items`** por `kind` → `materialItems` e `inventoryItems`.
  - **`hasMaterials` y `hasInventory`** se calculan a partir de las longitudes (`materialItems.length > 0`, `inventoryItems.length > 0`). **El cliente no los envía**; si los manda son ignorados.
  - **`generatedAt`**: se computa con `new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })`. Resultado tipo `"15 de mayo de 2026, 14:23"`.
  - **`subject` default**: si no llega o es vacío → `` `Alerta de stock bajo - ${gymName}` ``.
  - **`logoUrl` default**: si llega `undefined` se normaliza a `null` antes de pasar al servicio.
- **Escape HTML**: el renderer (`renderLowStockAlertHTML`) **sí escapa** `name`, `unit`, `gymName` y `generatedAt` con `escapeHtml`. Único endpoint de los tres que lo hace.
- **Formato de fechas / números**: `generatedAt` con locale `"es-CL"` y timezone `America/Santiago`. `currentStock` y `minStockAlert` se interpolan crudos (sin `toLocaleString` ni formateo).
- **Bulk**: **sí, `to` es array**. El servicio (`sendLowStockAlertEmail`) itera y envía **un correo por destinatario** vía `sendMail` (no fan-out en una sola llamada a Resend). No hay delay entre envíos en este endpoint (contraste con el reminder service).
- **Async**: handler espera (`await`) el envío de todos los correos antes de responder 200.

## Template HTML

- Archivo: `internal/html/low_stock_alert.html`.
- Renderer: `internal/service/lowStockAlert.ts → renderLowStockAlertHTML`.

### Placeholders consumidos

| Placeholder | Reemplazo | Notas |
|---|---|---|
| `{{logoImg}}` | `getLogoImgHtml(logoUrl, gymName)` | Global. |
| `{{gymName}}` | `escapeHtml(opts.gymName)` | Global. Title, preheader, header, saludo, footer. **Escapado**. |
| `{{generatedAt}}` | `escapeHtml(opts.generatedAt)` | Global. Barra dorada. |
| `{{year}}` | `new Date().getFullYear()` | Global. Footer. |
| `{{MATERIALS_SECTION}}` | HTML de la sección Materiales o `""` (string vacío) | Único. Si `hasMaterials === false`, se inserta `""` y la sección **desaparece** del email. |
| `{{INVENTORY_SECTION}}` | HTML de la sección Inventario o `""` | Único. Si `hasInventory === false`, sección omitida. |

### Tablas dinámicas

Cada sección (Materiales o Inventario) es una `<table>` envuelta en una caja con su color de acento:

- **Materiales** → título "Materiales con stock bajo", acento dorado `#D4A853`, fondo `#1c1608`, border `rgba(212,168,83,0.35)`.
- **Inventario** → título "Inventario con stock bajo", acento rojo `#fca5a5`, fondo `#180a0a`, border `rgba(239,68,68,0.32)`.

Las filas se construyen con `renderItemRows(items, accentColor)`: un `<tr>` por item con columnas **Item** (`name`), **Stock actual** (`currentStock` + ` ${unit}` si hay), **Mínimo** (`minStockAlert` + ` ${unit}` si hay). El último row sin border-bottom.

A diferencia de los otros dos reportes, **cuando un bucket está vacío, la sección entera se omite** (no aparece un placeholder "Sin items"). Si ambos están vacíos el email queda casi vacío — aunque la validación impide `items: []` así que al menos uno tiene contenido.

## Notas e inconsistencias

- **`to` es array** — único endpoint con esta forma. Resto del servicio usa `to: string`. Para el port a Go, considerar unificar la convención.
- **Multi-envío**: el servicio hace un `for ... of opts.to` y llama `sendMail` por cada destinatario, **sin delay** entre llamadas (el reminder service sí mete delays para rate-limit de Resend). Riesgo de rate-limit si la lista crece.
- **`hasMaterials` / `hasInventory` los calcula el servidor** (no el cliente). Si el cliente los manda en el body, se ignoran porque el controller los reescribe en la llamada a `sendLowStockAlertEmail`.
- **Validación robusta** en este controller — la mejor de los tres endpoints (devuelve 400 con detalles, no 500 con mensajes crípticos). Patrón a replicar en el port a Go para los otros reportes.
- **Escape HTML aplicado** — único endpoint que lo hace. Los otros dos (`send_daily_admin_report`, `send_daily_sales_report`) son vulnerables a inyección HTML vía nombres de usuario/plan/producto.
- **`generatedAt` se calcula server-side** con `America/Santiago`. Asimétrico con `reportDate` de los otros reportes (que llega pre-formateado del backend). Recomendado unificar en Go.
- **`logoUrl` debe ser HTTPS** — validación que **no existe** en los otros dos reportes. Endurecer en el port.
- **`unit` opcional pero validado**: si llega como string vacío se descarta del item normalizado.
- **`currentStock` permite 0**, `minStockAlert` no permite 0 (debe ser `> 0`). Documentado en error message.
- **`subject` default usa template literal** con `gymName` (después del trim).
- **CLAUDE.md global desactualizado**: ni siquiera lista este endpoint en la tabla de endpoints. La sección "API Endpoints" omite `send_low_stock_alert`.
- **Postman**: este endpoint **no aparece** en `docs/Powercave_Mail_Service.postman_collection.json`.
- **No persiste en `mail_logs`**: si N destinatarios fallan parcialmente (p. ej. uno rechazado por Resend), no hay trazabilidad. Considerar persistir o retornar resultado por destinatario en el port.
- **`Content-Type`**: no validado explícitamente; depende del body parser global de Express.
