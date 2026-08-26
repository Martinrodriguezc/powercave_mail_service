# POST /mail/send_trainer_email_verification

## Propósito
Envía al entrenador que acaba de registrarse el enlace para verificar su correo y activar su
cuenta. Hasta que lo use, el login del backend le responde 403 `EMAIL_NOT_VERIFIED`. El enlace
incluye un token de un solo uso con vigencia de 24 horas, indicada en el template.

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
| `to` | string | Sí | Destinatario. El handler solo verifica que sea truthy (no valida formato email). |
| `userName` | string | Sí | Nombre de pila del entrenador, para el saludo. Truthy, sin más validación. |
| `verificationLink` | string | Sí | URL completa con el token. La arma el **backend** con `FRONTEND_URL`; este servicio no conoce la URL del frontend. |
| `subject` | string | No | Si se omite o es falsy se usa `Verifica tu correo \| Dashcore`. |

**No acepta `gymName` ni `logoUrl`.** El entrenador no pertenece a ningún gimnasio: la cabecera del
correo lleva la marca de la plataforma, no la del gym.

## Responses

### 200 OK
`{ "message": "Trainer email verification sent successfully" }`

### 400 Bad Request
Falta alguno de los requeridos. El check es `!to || !userName || !verificationLink`, así que los
strings vacíos también se rechazan.
`{ "message": "Missing required fields: to, userName, verificationLink" }`

### 401 / 403 / 400
Errores de API Key, ver sección de autenticación.

### 500 Internal Server Error
Resend rechazó el envío o la API Key no está configurada.
`{ "message": "Error sending trainer email verification", "error": "<detalle>" }`

## Efectos secundarios

- **No escribe en `EmailLog`**, igual que los correos de bienvenida y el reset de contraseña.
- **Async**: el handler hace `await` antes de responder. El 200 implica que Resend aceptó el correo, no que el destinatario lo recibió.

## Template HTML

- Archivo: `internal/html/trainer_email_verification.html`
- Placeholders:
  - `{{userName}}` — saludo
  - `{{verificationLink}}` — dos veces, botón CTA y enlace de respaldo
  - `{{year}}` — año actual

## Notas

- La vigencia de 24 horas está escrita en el HTML y tiene que coincidir con la constante del backend. Si una cambia, la otra miente.
- Está registrado en `TEST_MAILS` (`internal/domain/testData.ts`), así que se puede mandar de prueba desde el panel del superadmin.
