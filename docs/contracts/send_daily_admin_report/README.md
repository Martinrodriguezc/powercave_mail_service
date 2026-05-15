# POST /mail/send_daily_admin_report

## Propósito

Envía al equipo administrativo del gimnasio un resumen diario de renovaciones: clientes con planes que vencen pronto (3 días o menos) y clientes con planes vencidos en los últimos 7 días. El destinatario es típicamente un correo administrativo del gimnasio (manager, recepción). Es disparado por un job programado en el backend (`sales_registry`) una vez al día.

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

El controller pasa el body crudo (`req.body`) directamente al servicio. El tipo del servicio es `AdminRenewalReportMail` (ver `internal/domain/mail.ts`). Las únicas validaciones server-side son las del servicio:

- `to` requerido (string truthy).
- `subject` requerido (string truthy).
- `sentBy` requerido (en realidad lo provee el controller con default `'daily_admin_report_backend'` si no llega, por lo que nunca falla esa validación).

Todo lo demás (forma de `expiringSoon`, `recentlyExpired`, tipos de los items, `reportDate`, `gymName`, `logoUrl`) **NO se valida**: si llega malformado se rompe en el renderer o se renderiza con strings vacíos / `undefined`.

```
{
  "to": "admin@powercavegym.cl",
  "subject": "Reporte diario de renovaciones - PowerCave",
  "gymName": "PowerCave",
  "logoUrl": "https://cdn.powercave.cl/logos/powercave.jpg",
  "reportDate": "15 de mayo de 2026",
  "sentBy": "daily_admin_report_backend",
  "expiringSoon": [
    { "userName": "Juan Pérez", "planName": "Plan Mensual Premium", "expiryDate": "17/05/2026" }
  ],
  "recentlyExpired": [
    { "userName": "Carla Muñoz", "planName": "Plan Mensual Premium", "expiryDate": "12/05/2026" }
  ]
}
```

| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `to` | `string` (email) | Sí | Destinatario único. Se valida solo que sea truthy; no hay regex de email server-side. |
| `subject` | `string` | Sí | Asunto del correo. Solo se valida que sea truthy. |
| `gymName` | `string` | No (efectivo) | Nombre del gimnasio. Si falta se renderiza como string vacío (`""`) en el template. Aparece en el header, `<title>`, saludo y footer. |
| `logoUrl` | `string \| null` | No | URL pública (HTTPS) del logo. Si se provee, se adjunta como inline-CID en el email. Si es null/vacío se renderiza fallback con iniciales del `gymName`. |
| `reportDate` | `string` | No (efectivo) | Fecha mostrada en la barra dorada (formato libre — el backend manda string pre-formateado en español, p. ej. `"15 de mayo de 2026"`). Si falta se renderiza como `""`. |
| `sentBy` | `string` | No | Identificador del agente que dispara el envío. Si falta, el controller usa default `'daily_admin_report_backend'`. Se pasa al `sendMail` como `userName` pero **no se persiste** (no hay mail_logs en este flujo). |
| `expiringSoon` | `Array<PlanItem>` | No (efectivo) | Lista de clientes con plan próximo a vencer. Si el array está vacío o falta, se renderiza el mensaje "Sin planes próximos a vencer." |
| `recentlyExpired` | `Array<PlanItem>` | No (efectivo) | Lista de clientes con plan recientemente vencido. Si está vacío o falta, se renderiza "Sin planes vencidos en los últimos 7 días." |

**`PlanItem`** (items de `expiringSoon` y `recentlyExpired` — misma forma para ambos):

| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `userName` | `string` | Sí (de facto) | Nombre completo del cliente. Se interpola directamente sin escape HTML. |
| `planName` | `string` | Sí (de facto) | Nombre del plan. Sin escape HTML. |
| `expiryDate` | `string` | Sí (de facto) | Fecha pre-formateada por el backend (formato libre, p. ej. `"17/05/2026"`). |

Ver `request.json` para ejemplo completo con todos los campos.

## Responses

### 200 OK

```json
{ "message": "Daily admin report sent successfully" }
```

Ver `response.json`.

### 400 / 401 / 403

Provienen del middleware `requireApiKey`:

- `400 Bad Request` — header `X-API-Key` duplicado.
- `401 Unauthorized` — header `X-API-Key` ausente.
- `403 Forbidden` — `X-API-Key` inválida.

### 500 Internal Server Error

```json
{ "message": "Error sending daily admin report", "error": "<error.message>" }
```

Posibles causas:

- `MAIL_SERVICE_API_KEY` no configurada → 500 con `"Server misconfiguration: API Key authentication is not properly configured"`.
- Validaciones del servicio fallan: `"Sent by is required"`, `"Destination email (to) is required"`, `"Subject is required"`. **Nota**: estas se devuelven como 500 (no como 400), porque el controller las captura en el catch genérico.
- Error de Resend al enviar.

## Comportamiento

- **Side effects**: ninguno hacia la base de datos. `sendMail` **no persiste** en `mail_logs` (revisar `internal/service/mail.ts` — solo loguea con pino). El único side-effect es el envío vía Resend.
- **Cálculos en el servidor**: ninguno. Las listas `expiringSoon` y `recentlyExpired` llegan ya seleccionadas y formateadas por el backend; `reportDate` viene pre-formateado como string; el año del footer se calcula con `new Date().getFullYear()`.
- **Formato de fechas / números**: el servidor **no formatea** `expiryDate` ni `reportDate` — ambos son strings literales que el backend manda listos. No hay conversión de timezone ni locale aplicada en mail_service.
- **Bulk**: no. Un solo destinatario por request (`to: string`). Para múltiples admins, el backend debe llamar al endpoint varias veces.
- **Async**: el handler espera (`await`) el envío; la respuesta 200 implica que Resend aceptó el correo. No es fire-and-forget.

## Template HTML

- Archivo: `internal/html/daily_admin_report.html`.
- Renderer: `internal/service/admin/helpers.ts → renderDailyAdminReportHTML`.

### Placeholders consumidos

| Placeholder | Reemplazo | Notas |
|---|---|---|
| `{{logoImg}}` | `getLogoImgHtml(logoUrl, gymName)` | Sustituido **globalmente** (regex `/g`). Genera `<img>` inline-CID o un fallback con iniciales. |
| `{{gymName}}` | `opts.gymName \|\| ""` | Global. Aparece en `<title>`, preheader, header, saludo y footer. |
| `{{reportDate}}` | `opts.reportDate \|\| ""` | Global. Barra dorada bajo el header. |
| `{{year}}` | `new Date().getFullYear()` | Global. Footer copyright. |
| `{{EXPIRING_SECTION}}` | Tabla HTML o párrafo "Sin planes próximos a vencer." | Sustitución única (no global). Color dorado (`#D4A853`) para fechas. |
| `{{RECENTLY_SECTION}}` | Tabla HTML o párrafo "Sin planes vencidos en los últimos 7 días." | Sustitución única. Color rojo claro (`#fca5a5`) para fechas. |

### Tablas dinámicas

`renderPlanRows(items, dateColor)` concatena un `<tr>` por cada item:

- Columnas: **Usuario** (`userName`), **Plan** (`planName`), **Vence el / Venció el** (`expiryDate` en color `dateColor`).
- El border-bottom del último row se omite (`border: none`).
- **Sin escape HTML**: los strings se interpolan crudos en el template. Riesgo de inyección HTML si el backend manda `<script>` u otros tags. Diferenciado del low_stock_alert que sí escapa.

### Diferenciación visual entre listas

- **`expiringSoon`** → header de tabla con label "VENCE EL", border dorado (`rgba(212,168,83,0.3)`), fechas en dorado (`#D4A853`). Box exterior con fondo `#1c1608` (warm dark).
- **`recentlyExpired`** → header de tabla con label "VENCIÓ EL", border rojo (`rgba(239,68,68,0.3)`), fechas en rojo claro (`#fca5a5`). Box exterior con fondo `#180a0a` (warm dark red).

## Notas e inconsistencias

- **Arrays vacíos / ausentes**: el helper hace `Array.isArray(opts.expiringSoon) && opts.expiringSoon.length > 0` — si el array no es array o está vacío, se renderiza un párrafo en cursiva "Sin planes próximos a vencer." (o el equivalente para `recentlyExpired`). La sección **no se omite**; siempre aparecen los dos bloques.
- **`reportDate` lo recibe el servidor, no lo calcula**. Contraste con `send_low_stock_alert` que sí calcula `generatedAt` server-side. Para el port a Go, mantener esta asimetría o unificar.
- **Sin escape HTML**: el renderer no aplica `escapeHtml` a `userName`, `planName`, `expiryDate`, `gymName` ni `reportDate`. Esto es una **discrepancia** con `low_stock_alert.ts` que sí escapa los campos. Recomendado endurecer en el port a Go.
- **Validaciones laxas**: errores de validación del servicio (`to`, `subject`) terminan como **500**, no 400, porque el controller los captura en un `catch` genérico. En Go, separar validación (400) de errores de envío (500).
- **`sentBy` no se persiste**: se loguea internamente pero el `mail_logs` no se escribe en este flujo (revisar `sendMail`). No hay trazabilidad histórica del envío en DB.
- **CLAUDE.md global desactualizado**: no menciona el `sentBy` ni que existen estas validaciones débiles.
- **Postman**: este endpoint **no aparece** en `docs/Powercave_Mail_Service.postman_collection.json` (verificado por búsqueda). Documentación de Postman incompleta.
- **`logoUrl`** acepta `null` y `undefined` indistintamente (se normaliza con `?? undefined` antes de pasar a `sendMail`).
- **`Content-Type`**: el controller no valida explícitamente que sea `application/json`; depende del body parser global de Express.
