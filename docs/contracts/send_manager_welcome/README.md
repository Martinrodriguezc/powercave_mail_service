# POST /mail/send_manager_welcome

## Propósito
Notifica al manager/dueño de un gimnasio recién dado de alta que su cuenta está activa, indicándole la fecha de inicio de servicio y la fecha en la que termina el primer mes gratis. Incluye un CTA hacia el panel de administración.

## Autenticación
- Mecanismo: API Key (header `X-API-Key`)
- Middleware: `requireApiKey`

## Request

### Headers
| Header | Valor | Requerido |
|---|---|---|
| `Content-Type` | `application/json` | Sí |
| `X-API-Key` | `<MAIL_SERVICE_API_KEY>` | Sí |

### Body
| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `to` | `string` | Sí | Dirección de email del manager. Validación: truthy (no `null`/`""`/`undefined`). No se valida formato de email en el controller. |
| `userName` | `string` | Sí | Nombre del manager. Se inyecta como `{{userName}}` en el template. |
| `gymName` | `string` | Sí | Nombre del gimnasio. Se inyecta en el template y arma el subject (`Bienvenido a {gymName}`). |
| `serviceStartDate` | `string` | Sí | Fecha de inicio del servicio. Se inyecta como string crudo en `{{serviceStartDate}}` (el formato es responsabilidad del backend caller). |
| `freeMonthEndsAt` | `string` | Sí | Fecha en la que termina el mes gratis. Se inyecta como string crudo en `{{freeMonthEndsAt}}`. |
| `loginLink` | `string` | Sí | URL del CTA "Ir al panel". Se inyecta en el botón y en el fallback link. |
| `logoUrl` | `string \| null` | No | URL pública del logo del gimnasio. Si está presente y no es vacío tras `trim()`, se adjunta como inline CID; si falta o es vacío, el template renderiza el bloque sin imagen vía `getLogoImgHtml`. |

Ver `request.json`.

## Responses

### 200 OK
Ver `response.json`.

```json
{ "message": "Manager welcome email sent successfully" }
```

### 400 Bad Request
- Falta uno o más de: `to`, `userName`, `gymName`, `serviceStartDate`, `freeMonthEndsAt`, `loginLink` (la validación es truthy en JS: `!to || !userName || ...`).

```json
{ "message": "Missing required fields: to, userName, gymName, serviceStartDate, freeMonthEndsAt, loginLink" }
```

- Header `X-API-Key` duplicado (devuelto por el middleware antes de llegar al handler):

```json
{ "message": "Bad Request: Duplicated X-API-Key header" }
```

### 401 Unauthorized
- Falta el header `X-API-Key`.

```json
{ "message": "Unauthorized: Missing X-API-Key header" }
```

### 403 Forbidden
- `X-API-Key` provista pero distinta a `MAIL_SERVICE_API_KEY` (comparación en tiempo constante con `crypto.timingSafeEqual`).

```json
{ "message": "Forbidden: Invalid API Key" }
```

### 500 Internal Server Error
- `MAIL_SERVICE_API_KEY` no está configurada en el entorno:

```json
{ "message": "Server misconfiguration: API Key authentication is not properly configured" }
```

- Falla al renderizar/enviar (excepción capturada del provider Resend o del `sendMail`):

```json
{ "message": "Error sending manager welcome email", "error": "<error.message>" }
```

## Comportamiento
- **Side effects**: envía email vía Resend (`internal/service/mail.ts`). No escribe en la tabla `EmailLog` (este endpoint no llama explícitamente al logging de DB). Loguea via Pino: `info` al enviar a Resend, `success` tras retornar 200, `error` ante fallas.
- **Rate limiting / delays**: ninguno; envío sincrónico de un único email.
- **Dedup / idempotencia**: no hay deduplicación. Llamadas repetidas envían múltiples correos.
- **Async**: el handler hace `await` del envío y responde solo después de que Resend acepte el correo (o falle).

## Template HTML
- Archivo: `internal/html/manager_welcome.html`
- Placeholders consumidos:
  - `{{logoImg}}` — bloque HTML construido por `getLogoImgHtml(logoUrl, gymName)` (img con CID si hay logo, fallback textual si no).
  - `{{userName}}`
  - `{{gymName}}` (aparece varias veces: header, body, footer, copyright)
  - `{{serviceStartDate}}`
  - `{{freeMonthEndsAt}}` (también referenciado en el preheader oculto)
  - `{{loginLink}}` (CTA y fallback)
  - `{{year}}` — generado en el server con `new Date().getFullYear()` (no viene en el body)

## Notas e inconsistencias
- El `CLAUDE.md` del proyecto **no lista** `/mail/send_manager_welcome` en su tabla de endpoints; el endpoint está implementado pero el doc está desactualizado.
- El endpoint **no aparece** en `docs/Powercave_Mail_Service.postman_collection.json`.
- No existe validación de formato (email, fechas, URL) — el servicio confía en el caller. `serviceStartDate` y `freeMonthEndsAt` se inyectan tal cual al HTML.
- No se persiste el envío en `EmailLog` aunque el modelo existe en el schema.
- El subject se construye en el server (`Bienvenido a ${gymName}`) — no es overridable por el caller.
- Si `logoUrl` viene como string vacío o solo espacios, `sendMail` lo trata como ausente (`trim()` + check de longitud) y no adjunta CID, pero `getLogoImgHtml` igualmente renderiza un fallback HTML basado en `gymName`.
