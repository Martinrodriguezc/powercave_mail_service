# POST /mail/send_client_app_invitation

## Propósito
Invita a un cliente del gimnasio a usar la app móvil "Dashcore Members". El correo incluye el código del gym (slug), el email de la cuenta y una contraseña temporal, además de pasos y badges para descargar la app desde App Store / Google Play.

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
| `to` | string | Sí | Destinatario; también se inyecta como `{{userEmail}}` en el template. |
| `tempPassword` | string | Sí | Contraseña temporal en texto plano que se muestra en el correo. |
| `gymName` | string | Sí | Nombre del gimnasio, usado en header, body, footer y subject. |
| `gymSlug` | string | Sí | Identificador corto del gym para que el cliente lo ingrese en el login de la app. |
| `logoUrl` | string \| null | No | URL del logo del gimnasio. Si está presente se adjunta inline (CID). |
| `appLogoUrl` | string \| null | No | URL del icono de la app Dashcore Members. Si está, renderiza un bloque `<img>` (no CID, usa la URL directa); si falta, el placeholder `{{appLogoImg}}` queda vacío. |
| `appStoreBadgeUrl` | string \| null | No | URL pública de la imagen del badge "Descargar en App Store". Si falta, se inyecta string vacío y el `<img>` quedará roto en el HTML. |
| `googlePlayBadgeUrl` | string \| null | No | URL pública del badge "Disponible en Google Play". Si falta, se inyecta string vacío. |
| `appStoreLink` | string \| null | No | El campo se acepta y se normaliza a `null`, pero **el template no lo usa**: los badges no llevan link clickeable en el HTML actual. |
| `googlePlayLink` | string \| null | No | Idem: se acepta pero **no aparece referenciado en el template**. |

Ver `request.json` para un ejemplo completo.

## Responses

### 200 OK
Email entregado a Resend correctamente. Forma: `{ "message": "Client app invitation email sent successfully" }`. Ver `response.json`.

### 400 Bad Request
Se devuelve cuando falta cualquiera de los campos requeridos. El check es `!to || !tempPassword || !gymName || !gymSlug`, por lo que strings vacíos también se rechazan.
Forma: `{ "message": "Missing required fields: to, tempPassword, gymName, gymSlug" }`.

### 401 Unauthorized / 403 Forbidden
Errores de autenticación de la API Key (ver sección de autenticación). Header duplicado retorna 400 con `{ "message": "Bad Request: Duplicated X-API-Key header" }`.

### 500 Internal Server Error
Se devuelve cuando el envío a Resend lanza una excepción. El handler captura con try/catch.
Forma: `{ "message": "Error sending client app invitation email", "error": "<error.message>" }`.

## Comportamiento

- **Side effects**: solo logging estructurado (Pino) y envío vía Resend. NO se persiste nada en `mail_logs` / `EmailLog`.
- **Rate limiting / delays**: ninguno. Envío unitario sin sleeps.
- **Dedup / idempotencia**: ninguna. Cada request reenvía la invitación sin chequear historial.
- **Async**: el handler hace `await sendClientAppInvitationEmail(...)` antes de responder.

## Template HTML

- Archivo: `internal/html/client_app_invitation.html`
- Placeholders que el service reemplaza:
  - `{{logoImg}}` — bloque HTML con `<img src="cid:...">` si hay `logoUrl`, vacío si no
  - `{{appLogoImg}}` — bloque HTML con un `<img>` apuntando directamente a `appLogoUrl` (NO usa CID), vacío si no
  - `{{gymName}}` — usado en header, body y footer
  - `{{gymSlug}}` — código del gym que el cliente ingresa en la app
  - `{{userEmail}}` — valor de `to`
  - `{{tempPassword}}` — contraseña temporal en texto plano
  - `{{appStoreBadgeUrl}}` — URL directa en `<img src>` del badge App Store; `""` si falta (genera src vacío)
  - `{{googlePlayBadgeUrl}}` — URL directa en `<img src>` del badge Google Play; `""` si falta
  - `{{year}}` — año actual
- **Subject**: `\`Bienvenido a la app | ${gymName}\`` (hardcodeado, no configurable vía request).

## Notas e inconsistencias

- **`appStoreLink` y `googlePlayLink` son aceptados pero ignorados**: el handler los destructura y los pasa al service, pero el template no contiene placeholders `{{appStoreLink}}` ni `{{googlePlayLink}}`, por lo que esos valores no aparecen en el correo. Los badges se renderizan como `<img>` sin envolverlos en `<a href>`. Esto luce como una feature incompleta. Bug a confirmar con producto antes del port a Go (decidir si añadir los enlaces al template o eliminar los campos).
- **Inconsistencia de manejo de logo**: el logo del gym usa CID (inline attachment), pero el `appLogoUrl` se inserta como URL directa (`<img src="${opts.appLogoUrl}">`), bypaseando el mecanismo CID. Esto implica que el receptor debe poder cargar imágenes remotas para ver el icono de la app.
- El endpoint NO aparece en `docs/Powercave_Mail_Service.postman_collection.json`.
- El `mail_service/CLAUDE.md` NO menciona este endpoint en su tabla de "API Endpoints" (la tabla está desactualizada).
- Si `appStoreBadgeUrl` o `googlePlayBadgeUrl` faltan, el template queda con `<img src="">`: render roto en clientes que no oculten imágenes con src vacío. Si se decide hacer estos campos requeridos en Go, sería un strict breaking change.
- `gymSlug` no tiene validación de formato (no se chequea kebab-case, longitud, etc.); se inyecta literal en el template.
