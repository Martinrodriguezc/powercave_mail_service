# POST /mail/send_password_reset

## Propósito
Envía un correo al staff (usuario de plataforma) con un enlace para restablecer su contraseña tras solicitarlo desde el flujo "Olvidé mi contraseña" del admin SPA. El enlace incluye un token y tiene una vigencia indicada en el template de 60 minutos.

## Autenticación
- Mecanismo: API Key (header `X-API-Key`)
- Middleware: `requireApiKey`
- Comportamiento: comparación constant-time (`crypto.timingSafeEqual`); rechaza header duplicado con 400; falta de header con 401; mismatch con 403. Si `MAIL_SERVICE_API_KEY` no está configurado en el servidor responde 500.

## Request

### Headers
| Header | Valor | Requerido |
|---|---|---|
| `Content-Type` | `application/json` | Sí |
| `X-API-Key` | `<MAIL_SERVICE_API_KEY>` | Sí |

### Body
| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `to` | string | Sí | Destinatario. El handler solo verifica que sea truthy (no valida formato email). |
| `resetLink` | string | Sí | URL completa con el token de reset. El handler solo verifica que sea truthy (no valida que sea URL). |
| `subject` | string | No | Asunto del correo. Si se omite o es falsy se usa `Restablece tu contraseña${gymName ? \` | ${gymName}\` : ""}`. |
| `gymName` | string \| null | No | Nombre del gimnasio para personalizar header, footer y subject. Si se omite se inyecta string vacío en el template. |
| `logoUrl` | string \| null | No | URL pública del logo del gimnasio. Si está presente y no es vacío, se adjunta como inline attachment con `contentId` derivado de `gymName` y se renderiza el bloque de logo en el template; si no, el placeholder `{{logoImg}}` se reemplaza por string vacío. |

Ver `request.json` para un ejemplo completo.

## Responses

### 200 OK
Email entregado a Resend correctamente. Forma: `{ "message": "Password reset email sent successfully" }`. Ver `response.json`.

### 400 Bad Request
Se devuelve cuando falta cualquiera de los campos requeridos (`to`, `resetLink`). El check es `!to || !resetLink`, por lo que strings vacíos también se rechazan.
Forma: `{ "message": "Missing required fields: to, resetLink" }`.

### 401 Unauthorized / 403 Forbidden
Errores de autenticación de la API Key (ver sección de autenticación). Forma: `{ "message": "Unauthorized: Missing X-API-Key header" }` o `{ "message": "Forbidden: Invalid API Key" }`. Header duplicado retorna 400 con `{ "message": "Bad Request: Duplicated X-API-Key header" }`.

### 500 Internal Server Error
Se devuelve cuando el envío a Resend lanza una excepción (red, API key inválida, dominio no verificado, payload rechazado, etc.). El handler captura el error con try/catch.
Forma: `{ "message": "Error sending password reset email", "error": "<error.message>" }`.

## Comportamiento

- **Side effects**: solo logging estructurado (Pino) y envío vía Resend. NO se persiste nada en `mail_logs` / `EmailLog`. El service `sendMail` no inserta filas en la DB.
- **Rate limiting / delays**: ninguno. Es un envío unitario sin sleeps.
- **Dedup / idempotencia**: ninguna. El endpoint no consulta envíos previos; cada request envía un correo nuevo.
- **Async**: el handler hace `await sendPasswordResetEmail(...)` antes de responder. El 200 implica que Resend aceptó el correo (no que el destinatario lo recibió).

## Template HTML

- Archivo: `internal/html/password_reset.html`
- Placeholders que el handler/service reemplazan:
  - `{{logoImg}}` — bloque HTML con `<img src="cid:...">` si hay `logoUrl`, vacío si no
  - `{{gymName}}` — usado dos veces (header y footer); `""` si no se proveyó
  - `{{resetLink}}` — usado dos veces (botón CTA y fallback link)
  - `{{year}}` — año actual (`new Date().getFullYear()`)

## Notas e inconsistencias

- El `mail_service/CLAUDE.md` lista este endpoint correctamente bajo "API Key" pero no menciona los campos opcionales `subject` ni `logoUrl`.
- El endpoint NO aparece en `docs/Powercave_Mail_Service.postman_collection.json` (la colección solo cubre `send_reminder` y `send_bulk_reminders`); no hay ejemplo de request validado externamente.
- No hay validación de formato: `to` puede ser cualquier string truthy y Resend lo rechazará downstream; eso se manifiesta como 500.
- El campo `subject` se acepta pero si llega como string vacío `""` es falsy y se aplica el default; pasar `subject: " "` se acepta tal cual.
- El default de subject construye `\`Restablece tu contraseña\`` sin sufijo cuando `gymName` falta o es falsy.
- El log de éxito usa `logger.success` (custom) con `{ email: to }`; útil para correlacionar en producción.
- La duración del token ("60 minutos") está hardcodeada en el HTML, no es configurable vía request.
