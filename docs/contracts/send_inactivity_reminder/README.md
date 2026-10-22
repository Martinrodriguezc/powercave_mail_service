# POST /mail/send_inactivity_reminder

> Campos comunes de identidad de gimnasio, registro en `mail_logs` y tope diario: ver [`../_common.md`](../_common.md).

## Propósito
Correo "Te extrañamos" a socios con plan activo que llevan X días sin asistir. El cron del backend lo llama una vez al día por gimnasio, a la hora configurada en `emailConfig.inactivityReminders`.

## Autenticación
- API Key (header `X-API-Key`), middleware `requireApiKey`.

## Body
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `reminders` | `array` | Sí | Puede venir vacío. |
| `reminders[].to` | `string` | Sí | Email del socio. |
| `reminders[].userName` | `string` | Sí | Nombre del socio. |
| `reminders[].publicId` | `string` | Sí | `publicId` del cliente. Se usa para el dedupe. |
| `reminders[].daysSinceLastVisit` | `integer` | Sí | Días desde la última visita, o desde el inicio del plan si nunca vino. |
| `reminders[].lastAccessAt` | `string (ISO) \| null` | No | Última asistencia. `null` si nunca vino. |
| `subject` | `string` | No | Por defecto `Te extrañamos | {gymName}`. |
| `gymName` | `string` | No | Nombre del gimnasio. |
| `logoUrl` | `string \| null` | No | Logo del gimnasio, adjunto como CID. |

## Dedupe (una vez por racha)
Se omite al socio si ya existe un `mail_logs` con `mail_type = inactivity_reminder`, el mismo `publicId` y `sentAt >= lastAccessAt` (`status` sent o failed: una dirección rota no se reintenta a diario). Cuando vuelve a asistir, `lastAccessAt` avanza y vuelve a ser elegible. Si `lastAccessAt` es `null`, basta cualquier envío previo.

## Responses
- `200` `{ "message", "total", "successful", "skipped", "failed", "failures"? }`
- `400` si `reminders` no es un array o falta un campo requerido.
- `401` / `403` por la API key.
- `429` `DAILY_EMAIL_LIMIT_REACHED`. El envío se corta y los pendientes salen en la corrida del día siguiente.
- `500` `{ "message": "Error sending inactivity reminders", "error" }`

## Template
`internal/html/inactivity_reminder.html`. Placeholders: `{{logoImg}}`, `{{gymName}}`, `{{userName}}`, `{{days}}`, `{{year}}`.
