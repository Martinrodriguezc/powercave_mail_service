# POST /mail/send_sales_order_to_factory

## Proposito

Enviar a la fabrica/proveedor (el destinatario `to`, tipicamente una direccion de produccion externa al gimnasio) una nota de venta B2B generada en el ERP de PowerCave/Dashcore. El correo contiene el detalle de productos, totales con IVA y el PDF completo de la nota de venta como adjunto para procesamiento en fabrica. Es el unico endpoint del subdominio B2B del mail_service y vive bajo `internal/b2b/salesOrder/`.

## Autenticacion

- Mecanismo: API Key (`X-API-Key` header).
- Middleware (en orden):
  1. `requireApiKey` — verifica que el header `X-API-Key` exista, no sea un array (header duplicado), y coincida con `config.MAIL_SERVICE_API_KEY` mediante `crypto.timingSafeEqual` para evitar timing attacks.
- Roles requeridos: no aplica (autenticacion servicio-a-servicio).

## Request

### Headers

| Header | Valor | Obligatorio |
|---|---|---|
| `X-API-Key` | El valor de `MAIL_SERVICE_API_KEY` del mail_service | Si |
| `Content-Type` | `application/json` | Si |

### Body

Toda la validacion del body ocurre en `validateBody` y `validateLine` dentro del controller (`internal/b2b/salesOrder/controllers/salesOrderFactory.ts`). No hay validacion con un schema declarativo (Zod/Joi); las reglas estan codificadas a mano.

| Campo | Tipo | Obligatorio | Validacion |
|---|---|---|---|
| `to` | string | Si | No vacio (`trim() !== ""`). Destinatario del correo. |
| `gymName` | string \| null | No | Si no es string, se normaliza a `null`. Usado en el subject y para derivar el `cid` del logo. |
| `gymLegalName` | string \| null | No | Razon social del gimnasio emisor; se imprime en el header del correo. Si es `null`, el template usa `gymName` como fallback, y si tambien es `null` queda string vacio. |
| `gymRut` | string \| null | No | Si presente, se renderiza un bloque `RUT: ...` bajo el nombre legal. |
| `logoUrl` | string \| null | No | URL del logo del gimnasio; si esta presente se adjunta como inline attachment (`cid:<gymName>_logo`) en el correo. |
| `orderNumber` | number | Si | Debe ser `number` (no se valida que sea entero ni positivo). Aparece en el subject, en el preheader, en el titulo "NOTA DE VENTA N° ..." y en el log. |
| `purchaseOrderNumber` | string \| null | No | Si presente, se imprime como "Orden de Compra: NV ...". |
| `createdAtISO` | string | Si | No vacio. Se parsea con `new Date()`; si es invalido (`NaN`), se renderiza string vacio. Formato esperado: ISO 8601. Se formatea con `toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })`. |
| `clientBusinessName` | string | Si | No vacio. Razon social del cliente comprador. |
| `clientRut` | string \| null | No | Si presente, se imprime como "RUT: ..." bajo el cliente. |
| `notes` | string \| null | No | Si presente, se imprime como "Observaciones: ...". |
| `lines` | array | Si | Debe ser array no vacio. Cada elemento validado por `validateLine`. |
| `lines[].productName` | string | Si | No vacio. |
| `lines[].description` | string \| null | No | Si no es string, se normaliza a `null`; en el HTML, `null` se renderiza como `-`. |
| `lines[].quantity` | number | Si | Debe ser `number` finito (`Number.isFinite`). Formateado a 0 decimales si `quantityUnit === "UNIT"`, sino a 2 decimales. |
| `lines[].quantityUnit` | string | Si | Debe ser uno de `"UNIT"`, `"KG"`, `"BOX"`. Se mapea a etiqueta visible: `UNIT → UD`, `KG → KG`, `BOX → CJ`. |
| `lines[].unitPrice` | string | Si | No vacio. Se pasa tal cual al template prefijado con `$`. El formateo numerico es responsabilidad del cliente. |
| `lines[].lineTotal` | string | Si | No vacio. Idem. |
| `subtotal` | string | Si | No vacio. String ya formateado. |
| `taxAmount` | string | Si | No vacio. String ya formateado. |
| `taxPercent` | number | Si | Debe ser `number` (no se valida rango). |
| `total` | string | Si | No vacio. String ya formateado. |
| `attachment` | object | Si | Objeto requerido. |
| `attachment.filename` | string | Si | No vacio. |
| `attachment.contentBase64` | string | Si | No vacio. PDF codificado en base64. Maximo `~14.0 MB` de string base64 (corresponde a 10 MB del PDF decodificado): `MAX_BASE64_LENGTH = ceil((10 * 1024 * 1024 * 4) / 3)`. |
| `attachment.mimeType` | string | Si | Debe ser exactamente el literal `"application/pdf"`. |

Ver `request.json`.

## Responses

### 200 OK

```json
{ "message": "Sales order factory email sent" }
```

Ver `response.json`.

### 400 Bad Request

Cualquier fallo de validacion lanza un `Error` con mensaje especifico capturado por el handler. Ejemplos del mensaje devuelto (`{ "message": "<error>" }`):

- `"Body must be an object"`
- `"to is required"`
- `"orderNumber must be a number"`
- `"createdAtISO is required"`
- `"clientBusinessName is required"`
- `"lines must be a non-empty array"`
- `"subtotal is required"`, `"taxAmount is required"`, `"total is required"`
- `"taxPercent must be a number"`
- `"attachment is required"`
- `"attachment.filename is required"`
- `"attachment.contentBase64 is required"`
- `"attachment.mimeType must be 'application/pdf'"`
- `"lines[<i>] must be an object"`
- `"lines[<i>].productName is required"`
- `"lines[<i>].quantity must be a finite number"`
- `"lines[<i>].quantityUnit must be one of UNIT, KG, BOX"`
- `"lines[<i>].unitPrice is required"`
- `"lines[<i>].lineTotal is required"`

Tambien 400 si llega `X-API-Key` duplicado (header como array): `{ "message": "Bad Request: Duplicated X-API-Key header" }`.

### 401 Unauthorized

- Falta `X-API-Key`: `{ "message": "Unauthorized: Missing X-API-Key header" }`.

### 403 Forbidden

- `X-API-Key` invalida: `{ "message": "Forbidden: Invalid API Key" }`.

### 413 Payload Too Large

- `attachment.contentBase64.length > MAX_BASE64_LENGTH` (PDF supera 10 MB decodificado): `{ "message": "attachment exceeds maximum size of 10 MB" }`.

### 500 Internal Server Error

- `MAIL_SERVICE_API_KEY` no configurada: `{ "message": "Server misconfiguration: API Key authentication is not properly configured" }`.
- Error al enviar via Resend o cualquier excepcion en `sendSalesOrderFactoryMail`: `{ "message": "Error sending sales order factory email", "error": "<mensaje del error>" }`.

## Comportamiento

- **Side effects**:
  - Envio de un correo via Resend a `to`, con:
    - `from`: `config.SENDER_EMAIL`.
    - `subject`: `` `Nueva orden de venta N° ${orderNumber}${gymName ? ` | ${gymName}` : ""}` ``.
    - `html`: renderizado por `renderSalesOrderFactoryHTML`.
    - `text`: string vacio.
    - `attachments`: el PDF de la nota de venta (siempre) y, si `logoUrl` esta presente, el logo inline como segunda imagen con `contentId` derivado de `gymName`.
  - Logs estructurados: `logger.success` al enviar OK; `logger.warn` si el adjunto excede tamaño; `logger.error` ante fallos de envio.
- **Multi-tenancy**: el endpoint NO consulta JWT ni `gymPublicId`. El backend que lo invoca pasa explicitamente `gymName`, `gymLegalName`, `gymRut`, `logoUrl` y todo el detalle. La multi-tenencia es responsabilidad del backend caller; aqui el mail_service es un mero renderizador/sender.
- **Logging en `mail_logs`**: NINGUNO. El handler no escribe en la tabla `mail_logs`. Esto es consistente con el hecho de que el enum `MailType` de Prisma solo admite `plan_renovation_reminder` y `admin_reminder`, ninguno de los cuales describe semanticamente una nota de venta B2B. Si en el futuro se quisiera loggear este envio, se requeriria extender el enum.
- **Escaping HTML**: todos los strings interpolados al template pasan por `escapeHtml` (`& < > " '`), incluidos `productName`, `description`, `unitPrice`, `lineTotal`, `clientBusinessName`, `clientRut`, `notes`, `purchaseOrderNumber`, `gymLegalName`, `gymRut`, `subtotal`, `taxAmount`, `total`, `attachment.filename`. `orderNumber` y `taxPercent` (numericos) se imprimen via `String(...)` sin escape.
- **Sin reintentos ni cola**: el envio es sincrono dentro del request. Si Resend falla, se devuelve 500.
- **Sin deduplicacion**: a diferencia de `send_reminder`, este endpoint no consulta historico para evitar reenvios; cada POST envia un correo nuevo.

## Template HTML

- Archivo: `internal/b2b/salesOrder/html/salesOrderFactory.html` (cargado al startup por `internal/b2b/salesOrder/domain/templates.ts` via `fs.readFileSync`).
- Placeholders sustituidos en `internal/b2b/salesOrder/service/salesOrderFactory.ts` mediante `String.replace(/\{\{...\}\}/g, ...)`:

| Placeholder | Origen |
|---|---|
| `{{logoImg}}` | HTML generado por `getLogoImgHtml(logoUrl, gymName)`. String vacio si `logoUrl` ausente. |
| `{{gymLegalName}}` | `gymLegalName ?? gymName ?? ""` escapado. |
| `{{gymRutBlock}}` | Bloque `<p>RUT: ...</p>` si `gymRut` presente, sino `""`. |
| `{{orderNumber}}` | `String(orderNumber)`. Aparece dos veces: en el preheader oculto y en el titulo. |
| `{{createdAtFormatted}}` | Fecha en formato `es-CL` ("15 de mayo de 2026"). String vacio si invalida. |
| `{{clientBusinessName}}` | Escapado. |
| `{{clientRutBlock}}` | Bloque con RUT del cliente si presente, sino `""`. |
| `{{purchaseOrderBlock}}` | `<div>Orden de Compra: NV ...</div>` si presente, sino `""`. |
| `{{notesBlock}}` | `<div>Observaciones: ...</div>` si presente, sino `""`. |
| `{{itemsRows}}` | Concatenacion de `<tr>...</tr>` por cada `line` con productName, description (o `-`), cantidad formateada (`24 UD`, `2.50 KG`, `6.00 CJ`), unitPrice y lineTotal. |
| `{{subtotal}}` | Escapado. |
| `{{taxAmount}}` | Escapado. |
| `{{taxPercent}}` | `String(taxPercent)`. |
| `{{total}}` | Escapado. |
| `{{attachmentFilename}}` | Escapado; aparece en el bloque amarillo "Nota de venta adjunta". |

## Notas e inconsistencias

- **Tipos numericos vs strings**: el contrato mezcla `quantity` y `taxPercent` como `number` con `unitPrice`, `lineTotal`, `subtotal`, `taxAmount` y `total` como `string` ya formateados. Esto es deliberado (el cliente formatea con miles/decimales en el locale chileno), pero asimetrico. Para el port Go conviene mantener exactamente la misma forma — el backend ya envia strings preformateados.
- **`createdAtISO` invalido devuelve string vacio**: no es 400. Una fecha invalida pasa la validacion (`isNonEmptyString` solo verifica que no este vacia), y el render imprime `""` en "Santiago, ...". El port Go deberia decidir si esto es un bug o feature.
- **`orderNumber` sin restricciones**: no se valida `> 0`, ni que sea entero. Un `orderNumber: 0` o `orderNumber: -5` pasa.
- **`taxPercent` sin restricciones**: cualquier `number` (incluido `NaN` por `JSON.parse` no genera `NaN`, pero `Infinity` si). El controller no valida `Number.isFinite` para `taxPercent`. (Para `quantity` si lo hace.)
- **MIME hardcodeado**: solo se acepta `application/pdf`. No hay forma de adjuntar otros formatos.
- **`attachment` es obligatorio**: no se puede enviar el correo sin PDF. Si el backend genera solo el HTML, este endpoint no aplica.
- **Limite de 10 MB se mide sobre la longitud del string base64, no sobre el PDF decodificado**: la formula `MAX_BASE64_LENGTH = ceil((10 MB * 4) / 3)` aproxima el tamaño decodificado, pero la comparacion exacta seria decodificar primero. En la practica, base64 puede tener padding que hace que strings de exactamente el limite decodifiquen a ligeramente menos de 10 MB. El port Go puede afinar esto.
- **No loggea en `mail_logs`**: como se menciono, el modelo `EmailLog` no contempla este tipo de correo. Recomendacion para el port Go: extender `MailType` con un valor `sales_order_to_factory` (o equivalente) y loggear, idealmente con campos adicionales para `orderNumber` y `gymPublicId` indexados para auditoria.
- **No esta en la coleccion Postman** (`docs/Powercave_Mail_Service.postman_collection.json`).
- **CLAUDE.md del repo no menciona este endpoint** ni el subdominio B2B. La fuente de verdad es el codigo.
- **El subject incluye `gymName` solo si esta presente**: si el backend olvida pasar `gymName`, el subject queda `"Nueva orden de venta N° 1042"`, lo cual el receptor en fabrica podria no poder correlacionar con un cliente.
