# POST /mail/send_campaign_email

## Propósito
Endpoint genérico de "reenvío": recibe un HTML **pre-renderizado por el backend** (típicamente una campaña de marketing o un broadcast manual) y lo envía vía Resend al destinatario. El mail_service no construye el contenido — solo inyecta opcionalmente el logo inline si el HTML incluye el placeholder `{{logoImg}}`.

## Autenticación
- Mecanismo: API Key (header `X-API-Key`)
- Middleware: `requireApiKey`

## Request

### Headers
| Header | Valor | Requerido |
|---|---|---|
| `Content-Type` | `application/json` | Sí |
| `X-API-Key` | `<MAIL_SERVICE_API_KEY>` | Sí |

### Body
| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `to` | `string` | Sí | Email destinatario. Validación: truthy. La interfaz `Mail` declara `string`; no se valida un array, pero Resend acepta arrays — uso no soportado por el contrato actual. |
| `subject` | `string` | Sí | Asunto del correo. Lo provee el caller (no se construye server-side). |
| `html` | `string` | Sí | HTML completo y pre-renderizado del cuerpo. Si contiene la cadena literal `{{logoImg}}`, se reemplaza por el bloque generado por `getLogoImgHtml(logoUrl, gymName)`; cualquier otro placeholder permanece intacto. |
| `gymName` | `string \| null` | No | Nombre del gimnasio. Usado por `getLogoImgHtml` para el alt-text y para el CID del logo en `sendMail`. |
| `logoUrl` | `string \| null` | No | URL pública del logo. Si está presente y no vacío tras `trim()`, se adjunta como attachment inline (CID); si no, no se adjunta nada y la sustitución de `{{logoImg}}` cae al fallback de `getLogoImgHtml`. |

Ver `request.json`.

## Responses

### 200 OK
Ver `response.json`.

```json
{ "message": "Campaign email sent successfully" }
```

### 400 Bad Request
- Falta uno o más de: `to`, `subject`, `html`.

```json
{ "message": "Faltan campos obligatorios: to, subject, html" }
```

- Header `X-API-Key` duplicado:

```json
{ "message": "Bad Request: Duplicated X-API-Key header" }
```

### 401 Unauthorized
- Falta `X-API-Key`.

```json
{ "message": "Unauthorized: Missing X-API-Key header" }
```

### 403 Forbidden
- `X-API-Key` inválida.

```json
{ "message": "Forbidden: Invalid API Key" }
```

### 500 Internal Server Error
- `MAIL_SERVICE_API_KEY` no configurada:

```json
{ "message": "Server misconfiguration: API Key authentication is not properly configured" }
```

- Falla al enviar (Resend u otro error en `sendMail`):

```json
{ "message": "Error sending campaign email" }
```

> Nota: a diferencia de otros endpoints, este NO incluye el campo `error` con el mensaje de la excepción en la respuesta 500.

## Comportamiento
- **Side effects**: envía email vía Resend. No persiste en `EmailLog`. Loguea con Pino: `info` al recibir, `success` al enviar, `error` ante fallas.
- **Rate limiting / delays**: ninguno; envío sincrónico de un único correo. No hay procesamiento por lotes ni delays.
- **Dedup / idempotencia**: ninguna. Llamadas repetidas envían múltiples correos.
- **Async**: el handler hace `await` del envío y responde tras Resend.

## Template HTML
- Archivo: ninguno — el body trae el HTML pre-renderizado. **No existe** `internal/html/campaign.html`.
- Placeholders consumidos: únicamente `{{logoImg}}` si el HTML lo incluye. Cualquier otro placeholder en el HTML (`{{userName}}`, `{{ctaUrl}}`, etc.) NO es procesado por el mail_service — debe venir ya sustituido desde el caller.

## Notas e inconsistencias
- El `CLAUDE.md` del proyecto **no lista** `/mail/send_campaign_email`; está implementado pero no documentado.
- El endpoint **no aparece** en el Postman collection.
- Es el único endpoint asignado donde **el subject lo provee el caller** (los otros lo construyen server-side).
- Es el único endpoint asignado cuya respuesta 500 **no incluye** el campo `error` con el mensaje de la excepción.
- Mensaje de error 400 está en **español** (`"Faltan campos obligatorios: to, subject, html"`), mientras que los otros endpoints del servicio usan inglés. Inconsistencia de idioma de errores.
- Usa la interfaz base `Mail` (no hay `CampaignMail` específico en `internal/domain/mail.ts`).
- El reemplazo de `{{logoImg}}` solo se ejecuta si el HTML contiene exactamente esa cadena; el caller decide si quiere logo embebido.
