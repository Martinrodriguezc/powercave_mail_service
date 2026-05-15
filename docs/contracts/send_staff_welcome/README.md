# POST /mail/send_staff_welcome

## Propósito
Notifica a un colaborador (staff/recepción/entrenador) recién creado en un gimnasio existente que su cuenta está activa y le entrega el enlace al panel. A diferencia del welcome de manager, este correo no menciona fechas de servicio ni período gratis.

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
| `to` | `string` | Sí | Dirección del staff. Validación: truthy (no `null`/`""`/`undefined`). |
| `userName` | `string` | Sí | Nombre del colaborador. Se inyecta como `{{userName}}`. |
| `gymName` | `string` | Sí | Nombre del gimnasio. Se inyecta en el template y arma el subject (`Bienvenido a {gymName}`). |
| `loginLink` | `string` | Sí | URL del CTA "Ir al panel". |
| `logoUrl` | `string \| null` | No | URL pública del logo. Si está presente y no es vacío tras `trim()`, se adjunta como inline CID; si falta, se renderiza fallback textual. |

Ver `request.json`.

## Responses

### 200 OK
Ver `response.json`.

```json
{ "message": "Staff welcome email sent successfully" }
```

### 400 Bad Request
- Falta uno o más de: `to`, `userName`, `gymName`, `loginLink`.

```json
{ "message": "Missing required fields: to, userName, gymName, loginLink" }
```

- Header `X-API-Key` duplicado:

```json
{ "message": "Bad Request: Duplicated X-API-Key header" }
```

### 401 Unauthorized
- Falta el header `X-API-Key`.

```json
{ "message": "Unauthorized: Missing X-API-Key header" }
```

### 403 Forbidden
- `X-API-Key` inválida.

```json
{ "message": "Forbidden: Invalid API Key" }
```

### 500 Internal Server Error
- `MAIL_SERVICE_API_KEY` no configurada:

```json
{ "message": "Server misconfiguration: API Key authentication is not properly configured" }
```

- Falla al enviar:

```json
{ "message": "Error sending staff welcome email", "error": "<error.message>" }
```

## Comportamiento
- **Side effects**: envía email vía Resend. No escribe en `EmailLog`. Loguea con Pino: `success` al completar, `error` ante fallas.
- **Rate limiting / delays**: ninguno.
- **Dedup / idempotencia**: ninguna; llamadas repetidas envían múltiples correos.
- **Async**: el handler hace `await` del envío y responde tras la confirmación de Resend.

## Template HTML
- Archivo: `internal/html/staff_welcome.html`
- Placeholders consumidos:
  - `{{logoImg}}` — generado por `getLogoImgHtml(logoUrl, gymName)`.
  - `{{userName}}`
  - `{{gymName}}` (header, body, footer)
  - `{{loginLink}}` (CTA y fallback)
  - `{{year}}` — generado server-side.

## Notas e inconsistencias
- El `CLAUDE.md` del proyecto **no lista** `/mail/send_staff_welcome`; está implementado pero documentado por omisión.
- El endpoint **no aparece** en el Postman collection.
- Diferencias respecto a `send_manager_welcome`:
  - **NO** acepta `serviceStartDate` ni `freeMonthEndsAt` (campos solo del manager).
  - El copy del template menciona "formas parte del equipo" en vez del trial gratis.
  - El preheader y el subhead del header dicen "Bienvenido al equipo" en lugar de "Bienvenido a Dashcore".
- No hay validación de formato. Subject construido server-side (`Bienvenido a ${gymName}`), no overridable.
- No se persiste el envío en `EmailLog`.
