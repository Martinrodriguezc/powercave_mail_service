# POST /mail/send_reminder

## Propósito

El backend de PowerCave corre un cron diario (`backend/`) que detecta planes próximos a vencer y dispara este endpoint con la lista consolidada de recordatorios para un gym. El `mail_service` se encarga de:

1. Enviar un email transaccional a cada cliente cuyo plan está por vencer.
2. Aplicar deduplicación contra `mail_logs` para no enviar dos recordatorios al mismo cliente dentro de una ventana corta (~48h).
3. Registrar el resultado de cada envío en la tabla `mail_logs` (modelo Prisma `EmailLog`).
4. Construir un reporte administrativo agregado y enviarlo por correo a uno o más destinatarios (típicamente managers/admins del gym) para que tengan visibilidad operacional del envío diario.

Es el endpoint más complejo del servicio porque combina: orquestación secuencial con rate-limit, deduplicación con consulta a DB, persistencia con dos escrituras separadas por reminder (pending → sent/failed), generación de dos templates HTML distintos, y un fan-out final a los `report_recipients`.

## Autenticación

- Mecanismo: API Key (header `X-API-Key`).
- Middleware: `requireApiKey` (`internal/middleware.ts/apiKeyAuth.ts`).
- Comparación en tiempo constante con `crypto.timingSafeEqual`. Si el header viene duplicado (array), responde 400. Si falta, 401. Si es inválido, 403.

## Request

### Headers

| Header | Valor | Requerido |
|---|---|---|
| `Content-Type` | `application/json` | Sí |
| `X-API-Key` | `<MAIL_SERVICE_API_KEY>` | Sí |

### Body

Forma top-level:

```json
{
  "reminders": [ ... ],
  "report_recipients": [ "admin@gym.com" ],
  "sentBy": "backend_service",
  "gymName": "Power Cave Las Condes",
  "logoUrl": "https://..."
}
```

Tabla top-level:

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `reminders` | array de objetos | Sí | Debe ser array. Si no lo es (o falta), responde 400 con `"Request body must be { reminders: [...], report_recipients: string[] }"`. Un array vacío `[]` es aceptado (no se valida tamaño) y produce un reporte vacío. |
| `report_recipients` | array de strings (email) | Sí | Debe ser array no vacío. Si no es array o tiene `length === 0`, responde 400 con `"report_recipients is required and must be a non-empty array of email addresses"`. No se valida formato del email. |
| `sentBy` | string | No | Default: `"backend_service"` (operador `??`). Se persiste en `EmailLog.sentBy`. |
| `gymName` | string | No | Se inyecta en el subject y en los templates HTML. Si es `undefined`, el subject queda `"Recordatorio: tu plan vence pronto | "` (con pipe y trailing space) y `{{gymName}}` se reemplaza por `""`. |
| `logoUrl` | string \| null | No | URL pública del logo del gym. Si está presente y no vacía/whitespace, se adjunta como inline attachment con `contentId` derivado de `gymName` y se inyecta como `<img src="cid:...">` en el HTML. Si es `null`/`undefined`/`""`/whitespace, el logo se omite. |

Tabla `reminders[i]`:

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `to` | string (email) | Sí | Falla con 400 si falta. No se valida formato; Resend reportará error en runtime si es inválido. |
| `userName` | string | Sí | Falla con 400 si falta. Se persiste en `EmailLog.clientName`. |
| `planName` | string | Sí | Falla con 400 si falta. |
| `expiryDate` | string | Sí | Falla con 400 si falta. Es **string libre** — el código nunca parsea esta fecha. El backend la envía pre-formateada (formato observado en Postman: `"01/09/25"`; recomendado: `"DD/MM/YYYY"`). Se imprime tal cual en el HTML. |
| `publicId` | string | No | Si está presente, activa la lógica de dedup contra `mail_logs` y dispara los inserts/updates de log. Si está ausente, el envío se considera "modo test" y NO se loggea en DB. |

El mensaje de error 400 para campos faltantes en un reminder incluye el índice: `"Missing required fields in reminder at index <i>. Required: to, userName, planName, expiryDate"`.

Ver `request.json` para un ejemplo completo con 3 reminders y 2 report_recipients.

## Responses

### 200 OK

Forma:

```json
{
  "message": "Reminders processed successfully",
  "total": 3,
  "successful": 1,
  "failed": 1,
  "failures": [ { "email": "...", "error": "..." } ]
}
```

| Campo | Significado |
|---|---|
| `message` | Constante: `"Reminders processed successfully"`. |
| `total` | Literal `reminders.length` (el conteo del input, no del reporte). |
| `successful` | Número de reminders con `status === "success"` (efectivamente enviados a Resend sin error). |
| `failed` | Número de reminders con `status === "failed"`. **Los `skipped` NO cuentan como failed** (confirmado en `sendBulkReminderMails`: el array `failed` se construye con `.filter(r => r.status === "failed")`). |
| `failures` | Array `[{ email, error }]`. **Solo aparece en el JSON si `result.failed.length > 0`** (controller usa `...(result.failed.length > 0 && { failures: result.failed })`). Si no hay fallos, la key se omite por completo (no aparece como `[]`). |

Importante: aunque haya items `skipped`, la respuesta no expone un conteo `skipped` top-level. Esa info solo viaja en el email de reporte administrativo.

Ver `response.json` para un ejemplo con un fallo.

### 400 Bad Request

Forma: `{ "message": "<detalle>" }`. Casos:

- `reminders` no es array o falta → `"Request body must be { reminders: [...], report_recipients: string[] }"`.
- `report_recipients` no es array o es array vacío → `"report_recipients is required and must be a non-empty array of email addresses"`.
- Algún `reminders[i]` no tiene `to`, `userName`, `planName` o `expiryDate` → `"Missing required fields in reminder at index <i>. Required: to, userName, planName, expiryDate"`.

Las validaciones ocurren en orden y son short-circuit (devuelven al primer error).

### 401 / 403 / 400 (auth)

Generados por `requireApiKey`:

- 400 `"Bad Request: Duplicated X-API-Key header"` si el header llega duplicado.
- 401 `"Unauthorized: Missing X-API-Key header"` si no viene el header.
- 403 `"Forbidden: Invalid API Key"` si no matchea.
- 500 `"Server misconfiguration: ..."` si `MAIL_SERVICE_API_KEY` no está configurada en el server.

### 500 Internal Server Error

Forma: `{ "message": "Error sending reminders", "error": "<mensaje>" }`. Se produce solo si una excepción se propaga fuera del `try/catch` del controller. En la práctica esto NO debería ocurrir por errores de Resend en reminders individuales (esos se capturan dentro de `sendBulkReminderMails` y van al campo `failures`); ocurriría por ejemplo si la conexión a Prisma cae globalmente, o si `sendReminderReportEmail` lanza (lo cual no debería pasar porque internamente captura — ver "Notas").

## Comportamiento

### Flujo principal

1. **Validación del body** (síncrono, en el controller).
2. **Construcción del subject** común de los reminders: `"Recordatorio: tu plan vence pronto | <gymName>"`.
3. **Mapeo a `ReminderMail`**: el controller copia campo a campo; `publicId`, `gymName`, `logoUrl` se incluyen solo si están definidos/no-null (spreads condicionales).
4. **`sendBulkReminderMails(reminderMails, sentBy)`** itera secuencialmente:
   - Para cada `reminder`, llama `sendReminderMail(reminder, sentBy)`.
   - Si la llamada devuelve OK → push `{ status: "success", error: null, reason: null }` al `reporte_final`.
   - Si lanza `RecentEmailSentError` → push `{ status: "skipped", error: null, reason: "Ya se envió un correo de recordatorio en las últimas 48 horas (último envío: <fecha>)" }`.
   - Si lanza cualquier otro error → push `{ status: "failed", error: <message>, reason: "Error al enviar: <message>" }`.
   - **Entre reminders consecutivos espera 1000 ms** (`delay(1000)`), excepto después del último. Esto es rate-limit para Resend (limit ~2 req/s).
5. Tras el bucle, el controller espera **2000 ms adicionales** (`setTimeout 2000`) antes de enviar el reporte.
6. **`sendReminderReportEmail(reporte_final, reportRecipients, gymName, logoUrl)`**:
   - Calcula `fecha` con `toLocaleDateString("es-CL", { timeZone: "America/Santiago", year: "numeric", month: "long", day: "numeric" })` (ej: `"15 de mayo de 2026"`).
   - Subject: `"[Gym Report] Estado de Recordatorios Diarios - <fecha>"`.
   - Genera el HTML del reporte (ver "Templates HTML").
   - Itera `report_recipients` **secuencialmente**, **1000 ms de delay entre ellos** (excepto el último).
   - **Si un envío de reporte falla, lo loggea con Pino pero NO re-lanza ni aborta** los siguientes ni la response. Los recipients fallidos no se exponen en la respuesta HTTP.
7. **Responde 200** con el resumen.

### Dedup detallado

- Función: `hasRecentReminderSent(publicId)`.
- Ventana: las **últimas 47 horas**. El código literal es:
  ```ts
  const fortyEightHoursAgo = new Date();
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 47);
  ```
  El **nombre de la variable dice "48" pero el valor es 47**. Ver "Notas e inconsistencias" — debe documentarse y preservarse en el port Go.
- Query Prisma: `emailLog.findFirst({ where: { publicId, mail_type: "plan_renovation_reminder", status: "sent", sentAt: { gte: fortyEightHoursAgo } }, orderBy: { sentAt: "desc" }, select: { sentAt: true } })`.
- Si hay match, `sendReminderMail` lanza `RecentEmailSentError(lastSentAt)`. La excepción se captura en `sendBulkReminderMails` y se mapea a `status: "skipped"`.
- La razón humana incluye la fecha del último envío formateada con `toLocaleString("es-CL", { timeZone: "America/Santiago", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })` (ej: `"13 de mayo de 2026, 09:42"`). Si `lastSentAt` es null, se usa `"fecha desconocida"`.
- **El dedup solo aplica si el reminder tiene `publicId`**. Sin `publicId`, ni se consulta DB ni se loggea — es el "modo test".

### Persistencia en `mail_logs` (modelo Prisma `EmailLog`)

Para cada reminder con `publicId`, en orden:

1. **Insert** `EmailLog` con:
   - `recipient = opts.to`
   - `subject = opts.subject`
   - `mail_type = "plan_renovation_reminder"`
   - `publicId = opts.publicId`
   - `clientName = opts.userName`
   - `status = "pending"`
   - `sentBy = sentBy` (default `"backend_service"`)
   - `sentAt = now()` (default de Prisma)
2. Llamada a `sendMail(...)` (Resend).
3. Si Resend resuelve: **Update** del mismo row a `status = "sent"`.
4. Si Resend lanza: **Update** a `status = "failed"` y `errorMessage = <mensaje>`. La excepción se re-lanza.

**No hay transacción** entre el insert y el update — si el proceso muere entre ambos pasos, queda un row `pending` huérfano. Documentado en "Notas".

Para reminders sin `publicId`, NO se inserta nada y `sendMail` se llama directo. Si falla, se propaga como cualquier error normal y el reminder cae como `status: "failed"` en el reporte.

### Side effects observables

- 0..N inserts y updates en `mail_logs` (uno por reminder con `publicId`).
- 0..N envíos a Resend para reminders (uno por reminder no-skipped).
- 1..M envíos a Resend para reportes administrativos (uno por `report_recipient`).
- Logging estructurado vía Pino (logger `mail-service`, `reminders`, `api-key-auth`).

### Subjects

- Reminder individual: `"Recordatorio: tu plan vence pronto | <gymName>"`. Con `gymName` undefined: `"Recordatorio: tu plan vence pronto | "` (pipe + espacio).
- Reporte admin: `"[Gym Report] Estado de Recordatorios Diarios - <fecha>"` donde `<fecha>` es `es-CL` long date en TZ America/Santiago.

### From / sender

- Header `From` lo setea `sendMail` con `config.SENDER_EMAIL` (env var). Mismo from para reminders y reportes.

## Templates HTML

### `internal/html/reminder.html`

Placeholders reemplazados (todos vía `replace(/.../g, ...)` salvo donde se nota):

- `{{logoImg}}` — HTML del `<img src="cid:...">` si hay `logoUrl` válido, o string vacío. Se aplica con `replace(/\{\{logoImg\}\}/g, ...)`.
- `{{userName}}` — `opts.userName || ""`. Global.
- `{{planName}}` — `opts.planName || ""`. Global.
- `{{expiryDate}}` — `opts.expiryDate || ""`. Global.
- `{{gymName}}` — `opts.gymName || ""`. Global. (El template lo usa en `<title>`, header, body y footer.)
- `{{year}}` — `new Date().getFullYear()` como string. Global.
- `{{#if ...}}...{{/if}}` — **eliminados** (no evaluados) con `html.replace(/\{\{#if.*?\}\}[\s\S]*?\{\{\/if\}\}/g, "")`. Es dead code de un intento de templating más sofisticado. Flagueado en "Notas".

No se hace HTML-escape de los valores. Si `userName` contiene HTML, se inyecta literal. Riesgo XSS bajo en este contexto (email), pero a considerar en el port Go.

### `internal/html/reminder_report.html`

Placeholders (`generateReminderReportHTML`):

- `{{reportDate}}` — string `es-CL` long date. Single replace (no global).
- `{{total}}`, `{{successful}}`, `{{skipped}}`, `{{failed}}` — counts del `reporte_final`. Single replace cada uno.
- `{{tableRows}}` — concatenación de `<tr>` construidos en código TS. Para cada item:
  - 4 columnas: Public ID (o `"N/A"`), email, estado coloreado (verde/naranja/rojo + íconos `✓` / `⏭️` / `✗`), razón/error.
  - El estado y los colores son: `success` → `#10b981` `"✓ Enviado"`, `skipped` → `#f59e0b` `"⏭️ Omitido"`, `failed` → `#ef4444` `"✗ Fallido"`.
  - Para la celda razón/error: si hay `reason`, se muestra. Si no pero hay `error`, se muestra el error **truncado a 200 chars** con `+ "..."` si excede. Si no hay ninguno, se muestra `"-"`.
- `{{logoImg}}` — global replace.
- `{{gymName}}` — global replace (`gymName || ""`).
- `{{year}}` — single replace.

El HTML del reporte no escapa contenido. Los emails se imprimen directo (potencial XSS si un cliente registró un email malicioso — bajo riesgo en email cliente final, pero a notar).

## Logo / CID

`sendMail` (`internal/service/mail.ts`):
- Si `opts.logoUrl` es string no-vacío (post-`trim`), agrega un attachment `{ path: logoUrl, filename: "logo.jpg", contentId: getLogoCid(opts.gymName) }`.
- Resend resuelve `path` descargando la imagen al momento del envío.
- El template HTML referencia el logo como `<img src="cid:<contentId>" ...>` (ver `getLogoImgHtml`).

## Notas e inconsistencias

1. **Bug potencial: ventana de dedup de 47h, no 48h.** El código resta `47` literal aunque la variable se llama `fortyEightHoursAgo`, el mensaje al usuario dice "48 horas", el `CLAUDE.md` dice 48, la clase de error se llama "Email already sent in the last 48 hours". Decisión recomendada para el port Go: **mantener el comportamiento literal de 47h** para no introducir regresión silenciosa, y abrir un commit separado que corrija a 48h (o documente intencionalidad) tras el port.
2. **Sin transacción DB**. El insert (`status=pending`) y el update (`status=sent|failed`) son operaciones independientes. Si el proceso muere entre ambas (crash, redeploy), queda un row `pending` huérfano que nunca se reconcilia. En el port Go: considerar `BEGIN/COMMIT` o un job de reconciliación.
3. **Sin timeout en `sendMail`**. Si Resend cuelga, el request entero cuelga. Ganancia clara del port Go con `context.Context` y `http.Client.Timeout`.
4. **`{{#if}}` no evaluado**. El regex que los elimina (`html.replace(/\{\{#if.*?\}\}[\s\S]*?\{\{\/if\}\}/g, "")`) revela un intento abandonado de templating tipo Handlebars. En el port Go con `html/template` esto puede implementarse de verdad si se necesita (no parece necesario hoy — el `reminder.html` no contiene ningún `{{#if}}`); si no, eliminar el regex.
5. **`CLAUDE.md` desactualizado**. El `CLAUDE.md` lista solo 7 endpoints pero el servicio tiene 14 (visible en `docs/contracts/`). También dice que el servicio corre en puerto 3000 — verificar contra config. Además dice "48 horas" en el patrón de dedup sin mencionar la inconsistencia de 47h. El Postman collection (`Powercave_Mail_Service.postman_collection.json`) está **completamente obsoleto**: documenta rutas inexistentes (`/mail/send_bulk_reminders`), bodies sin `report_recipients`, y responses que ya no se devuelven (`"Reminder sent successfully"`, `"Bulk reminders sent successfully"`).
6. **Validación de email inexistente**. Ni el formato de `to` ni el de `report_recipients[i]` se valida server-side. Resend falla en runtime. En el port Go: considerar `net/mail.ParseAddress`.
7. **`reminders: []` no falla.** Un array vacío es válido y produce un reporte con 0 rows. Se sigue enviando el email de reporte vacío a los recipients. Verificar si es comportamiento deseado.
8. **`skipped` no aparece en la response.** El cliente HTTP solo conoce `total/successful/failed`. Los `skipped` cuentan implícitamente como `total - successful - failed`. Si el caller necesita ese conteo, hoy solo está en el email de reporte. Considerar exponerlo en el port Go.
9. **Sin retry**. Si Resend devuelve un 5xx transitorio, el reminder se marca como `failed` permanente. Sin reintentos automáticos.
10. **El error de envío del reporte admin se silencia**. Si falla `sendReminderReportEmail` para uno o varios recipients, el caller HTTP nunca se entera (solo aparece en logs Pino). Documentar en el port Go.

## Reglas estrictas observadas

1. Fidelidad al código actual — incluida la ventana de 47h.
2. Español en prose; identificadores en inglés.
3. Solo se crearon archivos nuevos en `docs/contracts/send_reminder/`.
