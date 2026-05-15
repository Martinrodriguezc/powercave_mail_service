# GET /mail/last-emails-by-tenant

## Proposito

Listar los ultimos correos enviados, deduplicados por `publicId` (identificador del cliente/destinatario en el dominio del backend), para que un usuario MANAGER o SUPERADMIN pueda revisar desde el frontend la actividad reciente de correos transaccionales. El nombre del endpoint sugiere "agrupado por tenant", pero el codigo en realidad agrupa por cliente (`publicId`), no por gimnasio.

## Autenticacion

- Mecanismo: JWT Bearer (es el unico endpoint del servicio con autenticacion JWT; todos los demas usan `X-API-Key`).
- Middleware (en orden):
  1. `requireAuth` — valida el header `Authorization: Bearer <jwt>`, verifica la firma con `config.JWT_SECRET` (compartido con el backend) y carga el payload en `req.user`. El payload esperado es `DashcoreJwtPayload` con los campos `publicId`, `email`, `role`, `gymPublicId`, `gymName`.
  2. `requireMailServiceAccess` — exige que `req.user.role` sea `MANAGER` o `SUPERADMIN`. Cualquier otro rol (por ejemplo `STAFF`) recibe 403.
- Roles requeridos: `MANAGER`, `SUPERADMIN`.

## Request

### Headers

| Header | Valor | Obligatorio |
|---|---|---|
| `Authorization` | `Bearer <jwt>` firmado con `JWT_SECRET` | Si |
| `Content-Type` | No aplica (GET sin body) | No |

### Query parameters

El controller no lee `req.query` ni `req.params`. El endpoint no acepta ningun parametro de consulta: ni filtros, ni paginacion, ni rango de fechas, ni cantidad maxima. Cualquier query string que envie el cliente sera ignorado.

### Body

No aplica — es un GET. `request.json` contiene `{}` solo como placeholder.

Ver `request.json`.

## Responses

### 200 OK

```json
{
  "count": <number>,
  "data": [ EmailLog, ... ]
}
```

Cada elemento del array `data` proviene de `prisma.emailLog.findMany` con `select` explicito en estos campos:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | number | PK autoincremental |
| `publicId` | string | Identificador del cliente/destinatario; usado como clave de deduplicacion (`distinct: ["publicId"]`) |
| `clientName` | string | Nombre del cliente registrado al momento del envio |
| `recipient` | string | Email destino |
| `subject` | string | Asunto del correo |
| `mail_type` | enum | `plan_renovation_reminder` o `admin_reminder` (unicos valores del enum `MailType` en Prisma) |
| `status` | enum | `pending`, `sent` o `failed` |
| `sentAt` | string (ISO 8601) | Fecha/hora del envio (default `now()`) |
| `errorMessage` | string \| null | Mensaje de error de Resend cuando `status = failed` |
| `sentBy` | string | Identificador de quien origino el envio. Convencionalmente parece ser un `gymPublicId`, pero el schema lo declara solo como `String` sin FK ni validacion |

Ver `response.json`.

### 401 Unauthorized

- Falta el header `Authorization` o no empieza con `Bearer `: `{"message": "Missing or invalid token"}`
- Token vacio tras `Bearer `: `{"message": "Missing token"}`

### 403 Forbidden

- JWT valido pero el payload es un string en vez de objeto: `{"message": "Invalid token payload"}`
- JWT invalido o expirado (firma incorrecta, vencido, malformado): `{"message": "Invalid or expired token"}`
- JWT valido pero el rol no es `MANAGER` ni `SUPERADMIN`: `{"message": "User does not have necessary permissions"}`

### 500 Internal Server Error

- `JWT_SECRET` no configurado en el servidor: `{"message": "Server misconfiguration: missing JWT secret"}`
- Error en la consulta Prisma o cualquier excepcion en el handler: `{"message": "Error retrieving last emails by tenant"}`

## Comportamiento

- **Side effects**: Ninguno. Es una lectura pura sobre la tabla `mail_logs`.
- **Multi-tenancy**: NO HAY FILTRO POR TENANT. El controller invoca `getLastEmailByTenant()` sin argumentos y el service ejecuta `prisma.emailLog.findMany` sin clausula `where`. El `gymPublicId` del JWT autenticado no se consulta, no se pasa al service y no se usa en la query. En consecuencia:
  - Un MANAGER de un gimnasio ve los ultimos correos de TODOS los gimnasios del sistema.
  - Un SUPERADMIN tambien ve todo, lo cual es coherente con su rol, pero el comportamiento para MANAGER constituye un leak cross-tenant.
  - Aunque el modelo `EmailLog` no tiene un campo `gymId` explicito, el campo `sentBy` parece almacenar un identificador de gym (ver enum semantico) y podria usarse como filtro — pero hoy no se hace.
- **Paginacion / ordenamiento**:
  - Orden: `sentAt DESC` (mas reciente primero).
  - Deduplicacion: `distinct: ["publicId"]` — Prisma devuelve solo la primera fila por `publicId` segun el `orderBy`, es decir el correo mas reciente de cada cliente.
  - Limite: ninguno. La query no usa `take` ni `skip`. Si el sistema acumula millones de filas la respuesta puede ser muy grande y lenta.
  - Sin filtro de rango temporal.

## Template HTML

No aplica — el endpoint devuelve JSON.

## Notas e inconsistencias

- **Nombre engañoso**: el path sugiere agrupacion "por tenant" (por gimnasio), pero la deduplicacion es por `publicId` (cliente final). Es "ultimo correo por cliente", no "ultimo correo por gimnasio".
- **Tenant leakage**: como se documenta arriba, el endpoint no filtra por `gymPublicId` del JWT. Un MANAGER de gym A puede ver correos enviados por gym B. Para el port a Go conviene definir explicitamente la politica: o bien (a) filtrar por `sentBy == req.user.gymPublicId` para MANAGER y devolver todo para SUPERADMIN, o (b) preservar el comportamiento actual y renombrar el endpoint para reflejar que no esta scoped.
- **`gymPublicId` puede ser `null`**: el tipo `DashcoreJwtPayload` declara `gymPublicId: string | null`. Si se va a usar como filtro en el port, definir el comportamiento cuando es `null` (por ejemplo SUPERADMIN sin gimnasio asociado).
- **`distinct` + ordenamiento**: en Postgres via Prisma, `distinct` combinado con `orderBy` requiere que el primer `orderBy` sea por la columna `distinct` o que se ordene de forma compatible; Prisma resuelve esto en memoria si es necesario. Verificar en el port Go si se mantiene la misma semantica (en SQL plano seria un `SELECT DISTINCT ON (public_id) ... ORDER BY public_id, sent_at DESC`).
- **Sin limite duro**: añadir `LIMIT` (por ejemplo 100) y/o paginacion en el port Go.
- **Schema sin FK a gimnasio**: el modelo `EmailLog` no tiene relacion con un modelo `Gym`. El campo `sentBy` es un `String` libre. Esto deberia revisarse para el port: si se quiere filtrar por gym, conviene tener una columna tipada `gymPublicId` indexada.
- **No esta en la coleccion Postman** (`docs/Powercave_Mail_Service.postman_collection.json` solo documenta `send_reminder` y `send_bulk_reminders`).
- **`CLAUDE.md` del repo** declara que este endpoint devuelve "Recent emails grouped by tenant" — la palabra "grouped" es imprecisa; en realidad esta deduplicado por cliente.
