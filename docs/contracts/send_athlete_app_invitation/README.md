# POST /mail/send_athlete_app_invitation

> Campos comunes de identidad de gimnasio, registro en `mail_logs` y tope diario: ver [`../_common.md`](../_common.md). Este correo no tiene gimnasio: se registra sin atribución y no consume ningún cupo.

## Propósito
Entrega al atleta de un entrenador sus credenciales de Dashcore Athletes: el correo de acceso y una contraseña temporal, firmado con el nombre del entrenador. Es el gemelo de `send_client_app_invitation` sin gimnasio (Dashcore Athletes E3).

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
| `to` | string | Sí | Destinatario; también se muestra como el correo de acceso. |
| `tempPassword` | string | Sí | Contraseña temporal en texto plano. |
| `trainerName` | string | Sí | Nombre del entrenador que firma el correo. Se recorta; vacío es 400. |
| `appStoreLink` | string \| null | No | Link a la App Store. Sin badges: se renderiza como botón de texto. |
| `googlePlayLink` | string \| null | No | Link a Google Play. Idem. Sin ninguno de los dos, el bloque de descarga no aparece. |

Todo valor se escapa antes de interpolarse en el HTML. Ver `request.json`.

## Responses

### 200 OK
`{ "message": "Athlete app invitation email sent successfully" }`. Ver `response.json`.

### 400 Bad Request
Falta `to`, `tempPassword` o `trainerName` (vacío cuenta como faltante).
`{ "message": "Missing required fields: to, tempPassword, trainerName" }`.

### 401 Unauthorized / 403 Forbidden
Errores de la API Key (ver Autenticación).

### 500 Internal Server Error
Resend lanzó. `{ "message": "Error sending athlete app invitation email", "error": "<error.message>" }`.

## Comportamiento
- Registra la fila en `mail_logs` con `mail_type = athlete_app_invitation` y `gymPublicId` nulo.
- Sin gimnasio en el contexto no se aplica tope diario (`_common.md`).
- Sin dedup: cada request reenvía.
- El handler espera el envío antes de responder.

## Template HTML
- Archivo: `internal/html/athlete_app_invitation.html`
- Placeholders: `{{trainerName}}`, `{{userEmail}}`, `{{tempPassword}}`, `{{storeButtons}}` (bloque completo o vacío), `{{year}}`. El logo de DashCore va por CID (`cid:dashcore_logo`), lo adjunta `sendMail`.
- **Subject**: `Tu acceso a Dashcore Athletes` (fijo).
