# POST /mail/send_client_password_reset

## Propósito
Envía a un cliente del gimnasio (usuario de la app móvil) un código OTP de verificación para restablecer su contraseña. El correo muestra el OTP destacado e indica que expira en 15 minutos.

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
| `to` | string | Sí | Destinatario. Solo se verifica que sea truthy. |
| `otp` | string | Sí | Código OTP a mostrar en el correo. Se inyecta tal cual en el template (sin formato ni longitud forzados). |
| `gymName` | string | Sí | Nombre del gimnasio. Usado en subject, header, footer y en el cuerpo (mensaje de seguridad). |
| `logoUrl` | string \| null | No | URL del logo del gimnasio. Si está, se adjunta como inline CID. |

Ver `request.json` para un ejemplo completo.

## Responses

### 200 OK
Email entregado a Resend correctamente. Forma: `{ "message": "Client password reset email sent successfully" }`. Ver `response.json`.

### 400 Bad Request
Se devuelve cuando falta cualquiera de los campos requeridos. El check es `!to || !otp || !gymName`, por lo que strings vacíos también se rechazan.
Forma: `{ "message": "Missing required fields: to, otp, gymName" }`.

### 401 Unauthorized / 403 Forbidden
Errores de autenticación de la API Key (ver sección de autenticación). Header duplicado retorna 400 con `{ "message": "Bad Request: Duplicated X-API-Key header" }`.

### 500 Internal Server Error
Se devuelve cuando el envío a Resend lanza una excepción. El handler captura con try/catch.
Forma: `{ "message": "Error sending client password reset email", "error": "<error.message>" }`.

## Comportamiento

- **Side effects**: solo logging estructurado (Pino) y envío vía Resend. NO se persiste nada en `mail_logs` / `EmailLog` (el OTP no se guarda ni se valida acá; la generación, persistencia y validación del OTP es responsabilidad del backend que llama a este endpoint).
- **Rate limiting / delays**: ninguno. Envío unitario sin sleeps. Si un cliente solicita muchos resets, este servicio no aplica throttling propio.
- **Dedup / idempotencia**: ninguna. Cada request envía un nuevo correo.
- **Async**: el handler hace `await sendClientPasswordResetEmail(...)` antes de responder.

## Template HTML

- Archivo: `internal/html/client_password_reset.html`
- Placeholders que el service reemplaza:
  - `{{logoImg}}` — bloque HTML con `<img src="cid:...">` si hay `logoUrl`, vacío si no
  - `{{gymName}}` — usado en header, body (mensaje de seguridad) y footer
  - `{{otp}}` — usado dos veces (preheader oculto y caja destacada del código)
  - `{{year}}` — año actual
- **Subject**: `\`Codigo de verificacion | ${gymName}\`` (hardcodeado, no configurable vía request; nota: sin acentos en el subject).

## Notas e inconsistencias

- El `mail_service/CLAUDE.md` NO lista este endpoint en su tabla de "API Endpoints" (la tabla solo incluye 7 endpoints y está desactualizada respecto al código).
- El endpoint NO aparece en `docs/Powercave_Mail_Service.postman_collection.json`.
- El subject y partes del template usan texto sin acentos ("Codigo", "contrasena", "verificacion") por consistencia visual del HTML existente, no por requisito técnico.
- La duración del OTP ("15 minutos") está hardcodeada en el template; si el backend cambia la vigencia real del OTP, el correo seguirá diciendo 15 minutos hasta que se actualice el HTML.
- No hay validación de formato sobre `otp`: puede tener cualquier longitud o caracteres; el template usa monospace + letter-spacing optimizado para 6 dígitos pero acepta cualquier string.
- La interfaz `ClientPasswordResetMail` tipa `gymName: string` (requerido no-nullable), lo cual es consistente con la validación del handler.
- El subject se construye con template literal sin escape; un `gymName` con `|` u otros caracteres se inyecta literal.
