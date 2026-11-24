# POST /mail/send_guest_trial_confirmation

> Campos comunes de identidad de gimnasio, registro en `mail_logs` y tope diario: ver [`../_common.md`](../_common.md).

## Propósito
Confirma a un invitado sin cuenta la reserva de su clase de prueba, hecha desde el link público del gimnasio. Incluye el botón para cancelar la reserva.

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
| `cancelUrl` | `string` | Sí | Link público para cancelar la reserva. Debe ser una URL `http(s)`, si no responde `400`. |
| `gymAddress` | `string \| null` | No | Dirección del gimnasio. Si falta, el correo no muestra la fila de dirección. |
| `gymName` | `string \| null` | No | Va en el asunto: `Tu clase de prueba en {gymName} está confirmada`. Sin él: `Tu clase de prueba está confirmada`. |
| `logoUrl` | `string \| null` | No | Logo del gimnasio, adjunto como CID. |

Más los campos comunes (`gymPublicId`, `gymTimezone`, `dailyEmailLimit`, `sentBy`).

Todos los textos se escapan con `escapeHtml` antes de entrar a la plantilla.

## Responses
- `200` `{ "message": "Guest trial confirmation email sent successfully" }`
- `400` `{ "message": "Missing required fields: to, guestName, className, classDate, classTime, cancelUrl" }`
- `400` `{ "message": "cancelUrl must be an http(s) URL" }`
- `401` / `403` por la API key.
- `429` `DAILY_EMAIL_LIMIT_REACHED` si el gimnasio superó su tope diario.
- `500` `{ "message": "Error sending guest trial confirmation email", "error": "<error.message>" }`

## Template
`internal/html/guest_trial_confirmation.html`. Placeholders: `{{logoImg}}`, `{{gymName}}`, `{{gymLabel}}` (nombre o "tu gimnasio"), `{{guestName}}`, `{{className}}`, `{{classDate}}`, `{{classTime}}`, `{{addressRow}}` (fila completa o vacío), `{{cancelUrl}}`, `{{year}}`.

Se registra en `mail_logs` con `mail_type = guest_trial_confirmation`.
