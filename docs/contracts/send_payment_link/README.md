# POST /mail/send_payment_link

> Campos comunes de identidad de gimnasio, registro en `mail_logs` y tope diario: ver [`../_common.md`](../_common.md).

## Propósito
Envía a un cliente del gimnasio un correo con un link de pago (one-shot) o de activación de cobro recurrente, generado por el backend a través de un proveedor (ej. Mercado Pago). El correo muestra el monto, el concepto, el logo del proveedor y un botón hacia la URL de pago.

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
| `to` | `string` | Sí | Email del cliente. Validación: truthy. |
| `clientName` | `string` | Sí | Nombre del cliente. Se inyecta como `{{clientName}}`. |
| `paymentUrl` | `string` | Sí | URL del checkout del proveedor. Usada en el CTA y en el fallback link. |
| `amount` | `string` | Sí | Monto **ya formateado** (ej. `"$45.000 CLP"`). Es un string, no un número — el formateo es responsabilidad del backend caller. La validación es truthy: el string `"0"` pasaría pero `""` no. |
| `description` | `string` | Sí | Concepto del cobro (ej. nombre del plan). Se inyecta como `{{description}}`. |
| `providerName` | `string` | Sí | Nombre del proveedor de pagos (alt-text del logo). |
| `providerLogoUrl` | `string` | Sí | URL pública del logo del proveedor (Mercado Pago u otros). Se usa como `src` en un `<img>` remoto, no como CID attachment. |
| `gymName` | `string \| null` | No | Nombre del gimnasio. Si está presente, se concatena al subject (`Link de pago | {gymName}`); si no, el subject queda como `Link de pago`. |
| `logoUrl` | `string \| null` | No | URL pública del logo del gimnasio. Si presente y no vacío, se adjunta como inline CID. |
| `isRecurring` | `boolean` | No | Default `false`. Si `true`, cambia el CTA a "Activar cobro recurrente", el body text a la variante recurrente, y **oculta** la nota de expiración de 48 horas. |

Ver `request.json`.

## Responses

### 200 OK
Ver `response.json`.

```json
{ "message": "Payment link email sent successfully" }
```

### 400 Bad Request
- Falta uno o más de: `to`, `clientName`, `paymentUrl`, `amount`, `description`, `providerName`, `providerLogoUrl` (validación truthy).

```json
{ "message": "Missing required fields: to, clientName, paymentUrl, amount, description, providerName, providerLogoUrl" }
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

- Falla al enviar:

```json
{ "message": "Error sending payment link email", "error": "<error.message>" }
```

> Nota: el catch hace `error instanceof Error ? error.message : String(error)`, así que el campo `error` siempre es un string.

## Comportamiento
- **Side effects**: envía email vía Resend. No persiste en `EmailLog`. Loguea con Pino: `success` (con flag `isRecurring`) al completar, `error` ante fallas.
- **Rate limiting / delays**: ninguno; envío sincrónico.
- **Dedup / idempotencia**: ninguna.
- **Async**: el handler hace `await` del envío y responde tras Resend.

## Template HTML
- Archivo: `internal/html/payment_link.html`
- Placeholders consumidos:
  - `{{logoImg}}` — bloque generado por `getLogoImgHtml(logoUrl, gymName)`.
  - `{{gymName}}` (header, preheader, copyright; si viene `null`/falsy se reemplaza por string vacío).
  - `{{clientName}}`
  - `{{bodyText}}` — generado server-side según `isRecurring`:
    - `false` (default): "Se ha generado un link de pago a tu nombre. Revisa el detalle a continuacion y haz clic en el boton para completar el pago de forma segura."
    - `true`: "Se ha generado un link para activar tu cobro recurrente. Revisa el detalle a continuacion y haz clic en el boton para autorizar el cargo automatico de forma segura."
  - `{{description}}`
  - `{{amount}}`
  - `{{providerLogoUrl}}` — img remota (no CID).
  - `{{providerName}}` — alt-text del logo del proveedor.
  - `{{paymentUrl}}` — CTA y fallback link.
  - `{{ctaText}}` — `"Realizar pago"` cuando `isRecurring=false`, `"Activar cobro recurrente"` cuando `true`.
  - `{{expirationNote}}` — bloque HTML completo con "Este link expira en 48 horas." cuando `isRecurring=false`, **string vacío** cuando `true`.
  - `{{year}}` — generado server-side.

## Notas e inconsistencias
- El `CLAUDE.md` del proyecto **no lista** `/mail/send_payment_link`; está implementado pero no documentado.
- El endpoint **no aparece** en el Postman collection.
- `amount` es `string` (ya formateado), no `number`. Cualquier formateo (moneda, separadores) debe hacerlo el backend caller.
- `isRecurring` es opcional con default `false`. Cambia 3 elementos del template:
  1. `bodyText` (intro del correo)
  2. `ctaText` (label del botón)
  3. `expirationNote` (oculta la nota de 48h cuando es recurrente)
- El subject se construye server-side condicionalmente: `Link de pago | {gymName}` si hay `gymName`, `Link de pago` si no.
- `providerLogoUrl` se renderiza como `<img src="...">` remoto en el HTML (lo descarga el cliente de email), mientras que `logoUrl` del gym se adjunta como CID inline. Asimetría deliberada del template.
- Hay cadenas sin tilde dentro del template y del `bodyText` ("continuacion", "boton", "automatico", "Este es un correo automatico", "boton") — encoding-safety intencional, mantener tal cual en la migración a Go.
- No se persiste en `EmailLog`.
