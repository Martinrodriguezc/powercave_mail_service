# POST /mail/send_payment_failed

> Campos comunes de identidad de gimnasio, registro en `mail_logs` y tope diario: ver [`../_common.md`](../_common.md).

## Propósito
Avisa al socio que el cobro automático de su suscripción fue rechazado. El backend lo llama una vez por ciclo, en el primer rechazo.

## Autenticación
- API Key (header `X-API-Key`), middleware `requireApiKey`.

## Body
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `to` | `string` | Sí | Email del socio. |
| `clientName` | `string` | Sí | Nombre del socio. |
| `planName` | `string` | Sí | Plan de la suscripción. |
| `amount` | `string` | Sí | Monto ya formateado (ej. `"$45.000 CLP"`). |
| `providerName` | `string` | Sí | Pasarela (ej. `"Mercado Pago"`). |
| `reason` | `string \| null` | No | Motivo ya redactado para el socio. Si falta, el correo no muestra la fila de motivo. |
| `willRetry` | `boolean` | No | `true` si la pasarela volverá a intentar el cobro. Cambia el texto final. |
| `gymName` | `string \| null` | No | Se agrega al asunto: `Tu pago no se pudo procesar | {gymName}`. |
| `logoUrl` | `string \| null` | No | Logo del gimnasio, adjunto como CID. |

Todos los textos se escapan con `escapeHtml` antes de entrar a la plantilla.

## Responses
- `200` `{ "message": "Payment failed email sent successfully" }`
- `400` `{ "message": "Missing required fields: to, clientName, planName, amount, providerName" }`
- `401` / `403` por la API key.
- `429` `DAILY_EMAIL_LIMIT_REACHED` si el gimnasio superó su tope diario.
- `500` `{ "message": "Error sending payment failed email", "error": "<error.message>" }`

## Template
`internal/html/payment_failed.html`. Placeholders: `{{logoImg}}`, `{{gymName}}`, `{{clientName}}`, `{{amount}}`, `{{planName}}`, `{{reasonRow}}` (fila completa o vacío), `{{nextStepText}}`, `{{year}}`.

Se registra en `mail_logs` con `mail_type = payment_failed`.
