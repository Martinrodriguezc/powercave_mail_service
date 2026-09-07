# POST /mail/send_athlete_password_reset

> Campos comunes de identidad de gimnasio, registro en `mail_logs` y tope diario: ver [`../_common.md`](../_common.md). Este correo no tiene gimnasio: se registra sin atribución y no consume ningún cupo.

## Propósito
Entrega al atleta el código de 6 dígitos para recuperar su contraseña de Dashcore Athletes. Es el gemelo de `send_client_password_reset` sin gimnasio: la cabecera es la marca de la plataforma y la firma del entrenador es opcional (Dashcore Athletes E6).

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
| `to` | string | Sí | Destinatario. |
| `otp` | string | Sí | Código de 6 dígitos. El backend lo genera y solo guarda su hash. |
| `athleteName` | string \| null | No | Nombre del atleta para el saludo. Sin él el correo abre con "Hola,". |
| `trainerName` | string \| null | No | Nombre del entrenador. Sin él, la frase que lo nombra desaparece entera. |

Todo valor se escapa antes de interpolarse en el HTML. Ver `request.json`.

## Responses

### 200 OK
`{ "message": "Athlete password reset email sent successfully" }`. Ver `response.json`.

### 400 Bad Request
Falta `to` u `otp`. `{ "message": "Missing required fields: to, otp" }`.

### 401 Unauthorized / 403 Forbidden
Errores de la API Key (ver Autenticación).

### 500 Internal Server Error
Resend lanzó. `{ "message": "Error sending athlete password reset email", "error": "<error.message>" }`.

## Comportamiento
- Registra la fila en `mail_logs` con `mail_type = athlete_password_reset` y `gymPublicId` nulo.
- Sin gimnasio en el contexto no se aplica tope diario (`_common.md`).
- Sin dedup: cada request reenvía. Pedir un código nuevo invalida el anterior, pero eso lo resuelve el backend, no este servicio.
- El handler espera el envío antes de responder. El backend ignora el resultado: su respuesta al atleta es 200 exista o no la cuenta.

## Template HTML
- Archivo: `internal/html/athlete_password_reset.html`
- Placeholders: `{{greeting}}`, `{{otp}}`, `{{trainerLine}}` (frase completa o vacía), `{{year}}`. El logo de DashCore va por CID (`cid:dashcore_logo`), lo adjunta `sendMail`.
- **Subject**: `Tu código de recuperación | Dashcore Athletes` (fijo).
