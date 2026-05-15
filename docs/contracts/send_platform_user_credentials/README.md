# POST /mail/send_platform_user_credentials

## Propósito
Envía a un nuevo usuario de plataforma (staff/manager) sus credenciales iniciales: el correo de la cuenta y una contraseña temporal, junto con un enlace para forzar el reseteo en el primer login. Se dispara cuando el backend crea un usuario.

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
| `to` | string | Sí | Destinatario y también el `userEmail` que se inyecta en el cuerpo del correo. Solo se verifica que sea truthy. |
| `temporaryPassword` | string | Sí | Contraseña temporal en texto plano que el usuario verá en el correo. Solo se verifica que sea truthy. |
| `resetPasswordLink` | string | Sí | URL para que el usuario fije una contraseña propia. Solo se verifica que sea truthy. |
| `gymName` | string \| null | No | Nombre del gimnasio. Si se omite, el handler pasa `null` al service y se inyecta string vacío en el template; el subject queda como `Credenciales de tu cuenta` sin sufijo. |
| `logoUrl` | string \| null | No | URL del logo. Si está presente y no es vacío, se adjunta como inline CID y se renderiza el bloque de logo; si no, `{{logoImg}}` queda vacío. |

Ver `request.json` para un ejemplo completo.

## Responses

### 200 OK
Email entregado a Resend correctamente. **El handler responde con `res.status(200).send()`**, es decir, body vacío (sin JSON). Ver `response.json` (archivo `{}` solo como placeholder estructural; la respuesta real NO tiene Content-Type JSON ni cuerpo).

### 400 Bad Request
Se devuelve cuando falta cualquiera de los campos requeridos. El check es `!to || !temporaryPassword || !resetPasswordLink`, por lo que strings vacíos también se rechazan. Nota: el mensaje de error NO menciona `gymName` porque no es obligatorio.
Forma: `{ "message": "Missing required fields: to, temporaryPassword, resetPasswordLink" }`.

### 401 Unauthorized / 403 Forbidden
Errores de autenticación de la API Key (ver sección de autenticación). Header duplicado retorna 400 con `{ "message": "Bad Request: Duplicated X-API-Key header" }`.

### 500 Internal Server Error
Se devuelve cuando el envío a Resend lanza una excepción (red, API key inválida, dominio no verificado, payload rechazado, etc.). El handler captura con try/catch.
Forma: `{ "message": "Error sending platform user credentials email", "error": "<error.message>" }`.

## Comportamiento

- **Side effects**: solo logging estructurado (Pino) y envío vía Resend. NO se persiste nada en `mail_logs` / `EmailLog`.
- **Rate limiting / delays**: ninguno. Envío unitario sin sleeps.
- **Dedup / idempotencia**: ninguna. Cada request envía un nuevo correo aun si ya se envió previamente al mismo destinatario.
- **Async**: el handler hace `await sendPlatformUserCredentialsEmail(...)` antes de responder.

## Template HTML

- Archivo: `internal/html/platform_user_credentials.html`
- Placeholders que el service reemplaza:
  - `{{logoImg}}` — bloque HTML con `<img src="cid:...">` si hay `logoUrl`, vacío si no
  - `{{userEmail}}` — se inyecta el valor de `to`
  - `{{temporaryPassword}}` — texto plano de la contraseña temporal
  - `{{resetPasswordLink}}` — usado dos veces (botón CTA y fallback link)
  - `{{gymName}}` — usado en header y footer; `""` si no se proveyó
  - `{{year}}` — año actual

## Notas e inconsistencias

- **Inconsistencia importante de respuesta**: a diferencia de los otros 3 endpoints del controller que devuelven `{ "message": "..." }`, este responde 200 con cuerpo vacío (`res.status(200).send()`). El port a Go debería decidir si normalizar o mantener.
- El `mail_service/CLAUDE.md` lista el endpoint pero no documenta los campos ni la asimetría de respuesta vs los otros.
- El endpoint NO aparece en `docs/Powercave_Mail_Service.postman_collection.json`.
- En el body se acepta `gymName` y el handler usa el operador `??` para defaultearlo a `null`. Si llega como string vacío `""`, se considera truthy en el subject (`${gymName ? \` | ${gymName}\` : ""}` → ` | ` con string vacío después): genera un subject con un pipe colgante. Bug menor a considerar en el port.
- La interfaz `PlatformUserCredentialsMail` tipa `gymName: string | null` (no opcional), pero el handler lo trata como opcional pasando `gymName ?? null`.
- La contraseña temporal viaja en texto plano por email (decisión del producto, no del transporte).
