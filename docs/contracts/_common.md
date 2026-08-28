# Campos comunes de todos los endpoints de envío

Desde ago-2026 **todo** correo que sale por `mail_service` queda registrado en
`mail_logs`, atribuido al gimnasio que lo originó, y consume su cupo diario.

Antes solo registraban `send_reminder` y `send_app_release`. Los README de cada
endpoint que digan "NO se persiste nada en mail_logs" están desactualizados: la
regla vigente es la de este documento.

## Campos del body

Todos opcionales. Van en el body de cualquier endpoint de envío, además de los
campos propios de ese endpoint.

| Campo | Tipo | Descripción |
|---|---|---|
| `gymPublicId` | `string \| null` | UUID del gimnasio. Sin él, el correo se registra sin atribución y **no** se le aplica tope. |
| `gymName` | `string \| null` | Nombre del gimnasio, denormalizado en el registro. |
| `gymTimezone` | `string \| null` | Huso IANA. Define el corte del día. Inválido o ausente cae a `America/Santiago`. |
| `dailyEmailLimit` | `number \| null` | Tope diario propio del gimnasio. No entero o menor a 1 se ignora y usa `MAIL_DAILY_LIMIT_DEFAULT`. |
| `sentBy` | `string` | Origen del envío. Ya existía en algunos endpoints, ahora aplica a todos. |

El backend los arma en un solo lugar (`buildMailGymContext`) y los agrega a
cada payload saliente.

## Tope diario

Es un guardarraíl contra el uso excesivo, no una palanca comercial. El tope por
defecto es `MAIL_DAILY_LIMIT_DEFAULT` (1000).

Cuentan contra el cupo del día los correos en estado `sent` y `failed`: ambos
salieron hacia Resend. Los `blocked` no, nunca llegaron.

El día se corta a medianoche en el huso del gimnasio. La columna `localDay`
guarda esa fecha calendario, calculada al insertar.

### Al superar el tope

**Envío simple**: `429`.

```json
{
  "message": "Daily email limit reached (1000/1000)",
  "code": "DAILY_EMAIL_LIMIT_REACHED",
  "sentToday": 1000,
  "dailyLimit": 1000
}
```

**Envío por lote** (`send_campaign_batch`, `send_client_app_invitations_bulk`,
`send_app_release`): responde `200`. Los que entran en el cupo salen, el resto
vuelve con `status: "blocked"` en el array de resultados. Un lote parcialmente
enviado no es un error.

## Excepciones

- `POST /mail/send_app_release`: se registra atribuido a cada gimnasio (la
  atribución viaja por destinatario en `recipients[]`) pero **no** consume su
  cupo. El anuncio lo inicia el superadmin, el gimnasio no lo pidió.
- `POST /mail/test/send`: se registra sin gimnasio, porque quema cuota real de
  Resend. No consume el cupo de nadie y mantiene su propio límite en memoria de
  60 envíos cada 24 horas.
- La deduplicación de 47 horas de `send_reminder` no cambió y sigue siendo solo
  para recordatorios. Un recordatorio omitido por dedup no consume cupo.

## Consumo

`GET /mail/usage?month=YYYY-MM` (JWT, solo `SUPERADMIN`) devuelve el consumo de
la plataforma: totales del día y del mes, desglose por gimnasio y por tipo de
correo, y cuántos se bloquearon o fallaron.
