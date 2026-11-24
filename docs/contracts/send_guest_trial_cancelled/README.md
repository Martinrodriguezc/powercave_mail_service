# POST /mail/send_guest_trial_cancelled

> Campos comunes de identidad de gimnasio, registro en `mail_logs` y tope diario: ver [`../_common.md`](../_common.md).

## Propósito
Avisa a un invitado sin cuenta que su clase de prueba fue cancelada por el gimnasio y le sugiere contactarlo para coordinar otra fecha.

## Autenticación
- API Key (header `X-API-Key`), middleware `requireApiKey`.

## Body
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `to` | `string` | Sí | Email del invitado. |
| `guestName` | `string` | Sí | Nombre del invitado. |
| `className` | `string` | Sí | Nombre de la clase. |
| `classDate` | `string` | Sí | Fecha ya formateada en español (ej. `"martes 2 de diciembre"`). |
| `classTime` | `string` | Sí | Hora de inicio `HH:mm`. |
| `reason` | `"STAFF" \| "CLASS_CANCELLED"` | Sí | `CLASS_CANCELLED`: el gimnasio canceló la clase. `STAFF`: el staff canceló la reserva. Otro valor responde `400`. |
| `gymName` | `string \| null` | No | Va en el asunto: `Tu clase de prueba en {gymName} fue cancelada`. Sin él: `Tu clase de prueba fue cancelada`. |
| `logoUrl` | `string \| null` | No | Logo del gimnasio, adjunto como CID. |

Más los campos comunes (`gymPublicId`, `gymTimezone`, `dailyEmailLimit`, `sentBy`).

Todos los textos se escapan con `escapeHtml` antes de entrar a la plantilla.

## Responses
- `200` `{ "message": "Guest trial cancelled email sent successfully" }`
- `400` `{ "message": "Missing required fields: to, guestName, className, classDate, classTime, reason" }`
- `400` `{ "message": "Invalid reason. Expected one of: STAFF, CLASS_CANCELLED" }`
- `401` / `403` por la API key.
- `429` `DAILY_EMAIL_LIMIT_REACHED` si el gimnasio superó su tope diario.
- `500` `{ "message": "Error sending guest trial cancelled email", "error": "<error.message>" }`

## Template
`internal/html/guest_trial_cancelled.html`. Placeholders: `{{logoImg}}`, `{{gymName}}`, `{{gymLabel}}` (nombre o "tu gimnasio"), `{{guestName}}`, `{{reasonText}}`, `{{className}}`, `{{classDate}}`, `{{classTime}}`, `{{year}}`.

Se registra en `mail_logs` con `mail_type = guest_trial_cancelled`.
