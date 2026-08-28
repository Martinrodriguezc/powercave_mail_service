# POST /mail/send_trainer_invitation

> Campos comunes de identidad de gimnasio, registro en `mail_logs` y tope diario: ver [`../_common.md`](../_common.md).

## Propósito
Avisa a un entrenador que un gimnasio lo invitó a sumarse a su equipo. La invitación queda esperando
en su cuenta hasta que la acepte o la rechace; este correo solo le dice que existe.

Solo se invita a quien **ya tiene cuenta de entrenador**: el gimnasio no crea entrenadores. Por eso
el correo lleva al login y no a un registro.

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
| `gymName` | string | Sí | Nombre del gimnasio que invita. Aparece dos veces: en el preheader y en el cuerpo. |
| `loginLink` | string | Sí | URL de la pantalla de login. La arma el backend con `FRONTEND_URL`. |
| `subject` | string | No | Si se omite o es falsy se usa `${gymName} te invitó a su equipo \| Dashcore`. |

**No lleva `logoUrl`.** La cabecera es la marca de la plataforma: la invitación es un asunto entre
el entrenador y Dashcore, no una comunicación con la identidad visual del gimnasio.

## Responses

### 200 OK
`{ "message": "Trainer invitation sent successfully" }`

### 400 Bad Request
`{ "message": "Missing required fields: to, gymName, loginLink" }`

### 401 / 403 / 400
Errores de API Key, ver sección de autenticación.

### 500 Internal Server Error
`{ "message": "Error sending trainer invitation", "error": "<detalle>" }`

## Efectos secundarios

- **No escribe en `EmailLog`**, igual que el resto de los correos del entrenador.
- **Async**: el 200 implica que Resend aceptó el correo, no que llegó.

## Template HTML

- Archivo: `internal/html/trainer_invitation.html`
- Placeholders:
  - `{{gymName}}` — dos veces, preheader y cuerpo
  - `{{loginLink}}` — dos veces, botón CTA y enlace de respaldo
  - `{{year}}` — año actual

## Notas

- El backend se traga los errores de este envío: la invitación ya quedó escrita en la base, y un fallo de correo no puede convertirla en un 500 después. El manager la ve pendiente igual y puede cancelarla y reinvitar.
- Está registrado en `TEST_MAILS` (`internal/domain/testData.ts`).
