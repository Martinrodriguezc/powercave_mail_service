# POST /mail/send_trainer_account_exists

## Propósito
Avisa que ya existe una cuenta de Dashcore con ese correo, cuando alguien intenta registrarse como
entrenador con un correo ya tomado.

Es lo que sostiene la anti-enumeración del registro. El endpoint público
`POST /v1/trainer-account/register` responde **202 siempre**, exista o no la cuenta, así que sin
este correo un usuario legítimo que se olvidó de que ya tenía cuenta se queda en silencio total.

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
| `to` | string | Sí | Destinatario. El handler solo verifica que sea truthy. |
| `loginLink` | string | Sí | URL de la pantalla de login. La arma el backend con `FRONTEND_URL`. |
| `subject` | string | No | Si se omite o es falsy se usa `Ya tienes una cuenta \| Dashcore`. |

**No lleva `userName`.** El correo puede corresponder a una cuenta de panel de la que no se quiere
revelar nada, así que el cuerpo es deliberadamente genérico: no nombra a la persona, ni el rol, ni
el gimnasio.

## Responses

### 200 OK
`{ "message": "Trainer account exists notice sent successfully" }`

### 400 Bad Request
`{ "message": "Missing required fields: to, loginLink" }`

### 401 / 403 / 400
Errores de API Key, ver sección de autenticación.

### 500 Internal Server Error
`{ "message": "Error sending trainer account exists notice", "error": "<detalle>" }`

## Efectos secundarios

- **No escribe en `EmailLog`**.
- **Async**: el 200 implica que Resend aceptó el correo, no que llegó.

## Template HTML

- Archivo: `internal/html/trainer_account_exists.html`
- Placeholders:
  - `{{loginLink}}` — dos veces, botón CTA y enlace de respaldo
  - `{{year}}` — año actual

## Notas

- El backend se traga los errores de este envío. Un 500 acá no puede convertirse en un 500 del registro, porque delataría que el correo existe.
- Está registrado en `TEST_MAILS` (`internal/domain/testData.ts`).
