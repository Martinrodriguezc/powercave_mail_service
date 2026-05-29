# Decisiones de migración: mail_service (TS/Express) → mail (Go)

**Estado**: Aprobado, 2026-05-15
**Próximo paso**: Bootstrap del repo Go en `/Users/martin/Desktop/personal/mail/`
**Oráculo del comportamiento actual**: `mail_service/docs/contracts/` (14 endpoints, request/response/README cada uno)
**Hotfix ya aplicado**: tenant-leakage en `GET /mail/last-emails-by-tenant` cerrado con filtro `startsWith: cron_${gymName}` (ver `internal/service/tenant.ts`)

---

## Resumen ejecutivo

Migración del microservicio de correos transaccionales de Express+TS a Go, aplicando Clean Architecture + SOLID + DRY + YAGNI. Coexistencia con el servicio TS durante ~2-3 semanas vía feature flags en `backend/`; migración endpoint-por-endpoint con observación 24-48h entre fases. Estandarización agresiva del contrato — requiere cambios coordinados en los callsites de `backend/`.

---

## Tabla de decisiones

| # | Categoría | Decisión |
|---|---|---|
| 1 | Response envelope | `{ success, data, errors[], warnings[] }` con `Issue { code, message, field?, context? }` |
| 2 | Status codes | 400 cliente, 500 servidor, 401/403 auth — sin 422/502/503 |
| 3 | Estrategia DB | Misma DB compartida durante coexistencia, schema aditivo only |
| 4 | Persistencia | Los 14 endpoints loggean en `mail_logs` |
| 5 | Schema nuevo | Enum granular + `gymPublicId` + `providerMessageId` + `metadata` JSONB |
| 6 | Validación | Estricta (presencia + formato) con `go-playground/validator` |
| 7 | Reminder cleanups | Todos menos la ventana 47h (preservada con FIXME para commit post-cutover) |
| 8 | Templates HTML | Estructurales + fix de appStore href; tiempos hardcoded preservados |
| 9 | Body shape | Estandarización agresiva (contract-breaking, requiere migrar `backend/`) |
| 10 | Runtime Go | Timeouts en capas (30s req / 10s Resend / 5s DB); locale via request body |
| 11 | Repo + módulo | `/personal/mail/`, módulo `mail` (sin namespace), Go 1.25 |
| 12 | Plan de cutover | Phased per-endpoint con feature flag, ~2-3 semanas |

---

## 1. Response envelope

**Decisión**: Todos los 14 endpoints devuelven el mismo shape:

```json
{
  "success": boolean,
  "data": object | null,
  "errors": Issue[],
  "warnings": Issue[]
}
```

Donde `Issue = { code: string (SCREAMING_SNAKE), message: string, field?: string, context?: object }`.

**Reglas**:
- `success = true` cuando la request se procesó sin caída de infra. Fallos per-item en bulks NO flippean el flag (viven en `errors[]`).
- `errors[]` y `warnings[]` siempre presentes, vacíos `[]` cuando no hay nada.
- `data` siempre presente, `null` cuando no hay payload.
- `code` en inglés SCREAMING_SNAKE (`VALIDATION_FAILED`, `RECENT_EMAIL_SKIPPED`). `message` en inglés (API interna).
- Diferencia: `errors[]` = algo NO se hizo. `warnings[]` = se hizo pero con observaciones, o se saltó intencionalmente (ej. dedup).

**Casos de uso del envelope**:

```
SIMPLE OK                    BULK MIXTO (reminder)
{                            {
  "success": true,             "success": true,
  "data": null,                "data": { "total": 5, "successful": 3, "failed": 1, "skipped": 1 },
  "errors": [],                "errors": [{ "code": "RESEND_FAILED", ... }],
  "warnings": []               "warnings": [{ "code": "RECENT_EMAIL_SKIPPED", ... }]
}                            }

VALIDATION 400               INTERNAL 500
{                            {
  "success": false,            "success": false,
  "data": null,                "data": null,
  "errors": [                  "errors": [{ "code": "RESEND_FAILED", ... }],
    { "code": "REQUIRED", ... },"warnings": []
    { "code": "INVALID_EMAIL", ... }
  ],
  "warnings": []
}
```

---

## 2. Status codes

**Decisión**: Unificado simple — 400 para todo error de cliente, 500 para todo error interno, 401/403 para auth.

- **2xx**: 200 OK (con `success: true`, eventualmente con `errors[]` poblado en bulks parciales)
- **400**: parsing fail, validación, body inválido → `success: false`, `errors[]` poblado
- **401**: falta token / API key
- **403**: rol insuficiente / API key inválida
- **500**: Resend caído, DB timeout, panic, cualquier error interno

**Sin códigos nuevos** (no introducimos 422/502/503) para no romper backend que pueda asumir solo `if status === 500`.

**Arregla bug**: hoy `send_daily_admin_report` y `send_daily_sales_report` tiran 500 cuando deberían tirar 400 en validación. Con el rewrite + `validator`, todos los errores de cliente son 400.

---

## 3. Estrategia DB

**Decisión**: Misma DB (`powercave_mail_service_db`) compartida durante la coexistencia. Migraciones aditivas-only.

**Implementación**:
- Go agrega columnas nuevas como **nullable** (`gymPublicId`, `providerMessageId`, `metadata`).
- Extiende el enum `MailType` con nuevos valores (Postgres `ALTER TYPE ADD VALUE`).
- El TS sigue funcionando sin tocarlo — las columnas nuevas le son invisibles porque su Prisma client no las conoce.
- El query de dedup (47h en reminder) opera sobre la misma tabla — ambos servicios ven el mismo historial. Cero hueco en la ventana de dedup durante la migración.

**Post-cutover**:
1. Decidir backfill de `gymPublicId` para rows históricos (o aceptar NULLs).
2. `ALTER COLUMN gymPublicId SET NOT NULL`.
3. Dropear cualquier columna legacy del schema TS si la hay.

**Coordinación de migraciones**: Mientras coexistan, las migraciones se aplican desde el Go (via `golang-migrate`). Prisma del TS no se vuelve a tocar.

---

## 4. Persistencia en `mail_logs`

**Decisión**: Los 14 endpoints persisten en `mail_logs`. Cada envío crea un row con flujo `pending → sent | failed`.

**Razón**: hoy solo `send_reminder` loggea, generando un audit trail asimétrico. El MANAGER en `last-emails-by-tenant` solo ve reminders, no welcomes ni password resets de su staff. Con persistencia uniforme, el endpoint tenant entrega valor real.

**Importante**: el dedup 48h (47h literal, ver #7) **sigue siendo solo para reminders**. Loggear ≠ deduplicar. Otros endpoints no aplican dedup — son envíos intencionales individuales (password reset request, welcome a nuevo staff).

---

## 5. Schema nuevo de `mail_logs`

**Decisión**: Versión maximalista — granular enum + `gymPublicId` + `providerMessageId` + `metadata` JSONB.

**Migración SQL** (vive en `mail/migrations/0001_*.sql`):

```sql
ALTER TABLE mail_logs
  ADD COLUMN "gymPublicId"        TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN metadata             JSONB;

ALTER TYPE "MailType" ADD VALUE 'password_reset';
ALTER TYPE "MailType" ADD VALUE 'platform_user_credentials';
ALTER TYPE "MailType" ADD VALUE 'client_app_invitation';
ALTER TYPE "MailType" ADD VALUE 'client_password_reset';
ALTER TYPE "MailType" ADD VALUE 'payment_link';
ALTER TYPE "MailType" ADD VALUE 'manager_welcome';
ALTER TYPE "MailType" ADD VALUE 'staff_welcome';
ALTER TYPE "MailType" ADD VALUE 'campaign_email';
ALTER TYPE "MailType" ADD VALUE 'daily_admin_report';
ALTER TYPE "MailType" ADD VALUE 'daily_sales_report';
ALTER TYPE "MailType" ADD VALUE 'low_stock_alert';
ALTER TYPE "MailType" ADD VALUE 'sales_order_to_factory';
-- 'plan_renovation_reminder' y 'admin_reminder' ya existen

CREATE INDEX idx_mail_logs_gym_sent       ON mail_logs ("gymPublicId", "sentAt" DESC);
CREATE INDEX idx_mail_logs_provider       ON mail_logs ("providerMessageId") WHERE "providerMessageId" IS NOT NULL;
CREATE INDEX idx_mail_logs_dedup          ON mail_logs ("publicId", mail_type, "sentAt" DESC);
CREATE INDEX idx_mail_logs_metadata       ON mail_logs USING gin (metadata);
```

**Compromiso interno sobre `metadata` JSONB**: NO es cajón de sastre. Definimos un struct Go tipado por tipo de email (`type ManagerWelcomeMetadata struct { Locale string; CorrelationID string; ... }`) y lo serializamos. Auditor revisa que cada handler use el struct correspondiente.

**`providerMessageId`**: guarda el `id` que devuelve Resend en `resend.emails.send()`. Habilita futuras integraciones de webhooks (bounces, opens, complaints) sin nueva migración.

---

## 6. Validación de inputs

**Decisión**: Estricta — presencia + formato vía `go-playground/validator`. Cualquier input mal formado → 400 con error por campo en `errors[]`.

**Reglas estándar por tipo de campo**:

| Tipo | Tag de validación |
|---|---|
| Email (single) | `required,email` |
| Email (lista) | `required,dive,email` |
| URL | `required,url` (o `omitempty,url` si opcional) |
| Date ISO 8601 | `required,datetime=2006-01-02` (o full RFC3339 según campo) |
| Texto libre | `required,min=1,max=200` |
| UUID / publicId | `required,uuid` |
| OTP | `required,len=6,numeric` |
| Monto entero (CLP) | `required,min=0` |

**Códigos de error estandarizados** (en `errors[i].code`):

- `REQUIRED` — campo ausente
- `INVALID_EMAIL` — formato email inválido
- `INVALID_URL` — URL no parseable
- `INVALID_DATE` — fecha no parseable
- `INVALID_UUID`
- `INVALID_OTP`
- `OUT_OF_RANGE` — número fuera de min/max
- `TOO_LONG` / `TOO_SHORT` — string fuera de min/max length

---

## 7. Cleanups específicos del flujo `send_reminder`

**Decisión**: Todos los cleanups menos el bug de la ventana 47h.

**Aplicados durante el port**:
1. **Transacción**: el par `INSERT pending` + `UPDATE sent|failed` queda envuelto en `pgx.BeginTx`. Elimina rows huérfanos `pending` ante crashes entre operaciones.
2. **`skipped` visible**: emails saltados por dedup viajan en `warnings[]` del envelope con `code: RECENT_EMAIL_SKIPPED` y `context: { email, publicId, lastSentAt }`.
3. **Errores del reporte admin no silenciados**: si falla el envío del reporte a algún `report_recipient`, va en `errors[]` con `code: REPORT_DELIVERY_FAILED, context: { recipient }`. Hoy se loggean solo a Pino y se ocultan al caller.
4. **`reminders: []` rechazado**: 400 con `code: EMPTY_REMINDERS_ARRAY`. Hoy acepta y manda reporte vacío.

**Preservado literal con `// FIXME`**:
- **Ventana de dedup 47h**: `const dedupWindow = 47 * time.Hour // FIXME: should be 48h, see post-cutover commit`. Variable, error string y mensaje al admin siempre dijeron "48h" pero el código resta 47. Fix se hace en commit aparte post-cutover para no mezclar el cambio de lenguaje con un cambio de comportamiento de dedup.

---

## 8. Templates HTML

**Decisión**: Cleanups estructurales + fix de render. Tiempos hardcoded se mantienen.

**Aplicados**:
1. **Auto-escape** vía `html/template` (gratis por default de Go). Mata el riesgo XSS en los ~10 templates que hoy interpolan `userName`/`clientName`/`gymName` con `string.replace`.
2. **`{{#if ...}}{{/if}}` muerto removido**: hoy se borra con regex sin evaluar (dead code de un template engine no terminado). Reescribimos como `{{if .Field}}...{{end}}` nativo donde aplique, o se elimina si no se usa.
3. **HTML inline → template real**: `generateReminderReportHTML` en `service/reminders.ts` construye `<tr>` por item con styles inline en código TS. En Go, esto vive en `reminder_report.html` con `{{range .Results}}<tr>...</tr>{{end}}`.
4. **`appStoreLink` / `googlePlayLink` ahora se usan**: hoy el body acepta esos campos pero el template solo muestra los badges como `<img>` sin `<a href>`. Fix: envolver con `<a href="{{.AppStoreLink}}">`. Cero cambio de contrato (los campos ya llegan).

**No se cambia**:
- Tiempos hardcoded ("60 minutos" en password reset, "15 minutos" en OTP). Son policy alineada con el backend; si la policy cambia, se cambia en ambos lados.

---

## 9. Body shape: estandarización agresiva

**Decisión**: Forzamos shapes uniformes. Esto **rompe el contrato actual** — requiere migrar callsites del backend.

**Cambios obligatorios al contrato**:

| Cambio | Antes | Después |
|---|---|---|
| `to` como array siempre | `"to": "x@y.com"` (13 endpoints) | `"to": ["x@y.com"]` (todos los 14) |
| Totales validados | Backend manda `totalRevenue` y el server confía | Si `totalRevenue != sum(items)` → 400 con `code: TOTAL_MISMATCH` |
| Fechas ISO 8601 | `"reportDate": "15 de mayo de 2026"` | `"reportDate": "2026-05-15T00:00:00-04:00"`; server formatea según locale |
| Amounts como número | `"amount": "$15.000"` | `"amount": 15000` (CLP, sin formato); server formatea con `NumberFormat es-CL` |

**Implicación**: el backend (`backend/src/services/cron/cronTasks.ts` y cualquier otro callsite) tiene que adaptar TODOS los body payloads antes/durante la migración. Este es el motivo del cutover phased (decisión #12) — migramos endpoint por endpoint con feature flag, sin big-bang.

---

## 10. Convenciones de runtime Go

**Decisión**: Timeouts en capas + locale por request.

**Timeouts**:

```
HTTP request total:       30s   (handler context)
  ├─ Resend send:         10s   (sub-context)
  └─ Postgres query:       5s   (sub-context)
```

Cancelación propagada: si el cliente cierra la conexión, todos los sub-contextos se cancelan. Si Resend cuelga, el handler aborta a los 10s. Hoy con el TS no hay timeouts — un Resend lento satura workers.

**Locale + timezone**: campos opcionales del body con defaults `es-CL` / `America/Santiago`:

```json
{
  "to": ["..."],
  "locale": "es-CL",
  "timezone": "America/Santiago",
  ...
}
```

Valores inválidos (no parseables por la stdlib de Go) → 400 con `code: INVALID_LOCALE` o `INVALID_TIMEZONE`. El server usa estos para formatear fechas y números (los amounts numéricos de decisión #9).

---

## 11. Repo, módulo Go y versión

**Decisión**:

- **Ubicación local**: `/Users/martin/Desktop/personal/mail/`
- **Nombre del binario / servicio**: `mail`
- **Módulo Go**: `module mail` en `go.mod` (sin namespace de hosting — rename-friendly)
- **Versión Go**: `1.25`

**Imports quedan**:
```go
import (
    "mail/internal/domain"
    "mail/internal/usecase"
    "mail/internal/adapter/http"
)
```

**Rename futuro** (cuando se decida org de GitHub):
```bash
find . -name '*.go' -exec sed -i '' 's|"mail/|"github.com/<org>/mail/|g' {} +
# + actualizar go.mod manualmente
```

---

## 12. Plan de cutover: phased por endpoint

**Decisión**: Backend agrega feature flag por endpoint que decide a qué URL apuntar. Migramos un endpoint a la vez con observación 24-48h.

**Fases**:

### Fase 0 — Bootstrap (semana 1)
- Go corre en URL paralela (Railway: `mail-go-...`).
- Health checks, logs estructurados (slog), métricas básicas funcionando.
- Schema applied via `golang-migrate` (la DB compartida ya tiene las columnas nuevas, columnas legacy permanecen).
- Backend aún apunta 100% al TS.
- Tests de contrato pasan contra el Go contra los `request.json` / `response.json` de `mail_service/docs/contracts/`.

### Fase 1 — Endpoints "leaf" (semanas 2)
- `send_manager_welcome`, `send_staff_welcome`, `send_password_reset`, `send_platform_user_credentials`, `send_client_app_invitation`, `send_client_password_reset`, `send_campaign_email`, `send_payment_link`, `send_sales_order_to_factory`.
- Cada uno: backend actualiza callsite al contrato nuevo, mete flag, deploy, observa 24-48h.

### Fase 2 — Cron jobs (semanas 2-3)
- `send_daily_admin_report`, `send_daily_sales_report`, `send_low_stock_alert`. Críticos: corren diariamente, fallar significa que el MANAGER no se entera de su día.
- Observación mínima: 1 ciclo completo (24h) antes de marcar migrado.

### Fase 3 — Reminder + tenant query (semana 3)
- `send_reminder` (el más complejo) y `GET /mail/last-emails-by-tenant` al final.
- Reminder corre diario; observación de 1 ciclo.

### Fase 4 — Archivado
- Backend remueve feature flags (todo apunta a Go).
- Migración `ALTER COLUMN gymPublicId SET NOT NULL`.
- `mail_service/` (TS) se archiva: `git mv mail_service mail_service_legacy` o tag final + remove.
- Railway: apagar el deploy del TS.

**Rollback**: en cualquier momento, cambiar el feature flag del endpoint problemático de vuelta al TS. <1 minuto. El TS sigue funcionando hasta Fase 4.

---

## YAGNI — qué NO hacemos en esta migración

- **No gRPC / Connect**: REST + JSON. Decidido en pregunta separada.
- **No abstracción multi-provider** de email (Sendgrid/Mailgun). Una sola impl: Resend. La interface `Sender` ya queda para si llega el día.
- **No `dto` + `entity` + `mapper`** por dominio. Un struct hace JSON binding + interface `Templated`.
- **No DI framework** (wire/dig/uber-fx). Constructor injection en `cmd/mail/main.go`.
- **No CQRS, event sourcing, mediator pattern, aggregates DDD**. Es un sender stateless con un log.
- **No retry queue propia**. Resend ya retriea internamente.
- **No abstracción de logger detrás de interface propia**. `*slog.Logger` directo.
- **No microservicios dentro del microservicio**. Un binario.
- **No OpenAPI codegen** en la primera versión. Si después se quiere typed client en backend, se agrega como capa opcional (~1 día).

---

## Coordinación con `backend/` (multi-repo)

Esta migración **no es independiente**. Acciones requeridas en `backend/` antes/durante el cutover:

1. **Feature flags por endpoint**: agregar mecanismo (env var o config) que routea cada llamada a TS o Go.
2. **Migrar payloads** de los 13 callsites a los nuevos shapes (ver #9):
   - `to: string` → `to: [string]`
   - `reportDate: "..."` formateado → ISO 8601 raw
   - `amount: "..."` formateado → entero CLP
   - `totalRevenue` validado por suma de items (backend debe asegurar consistencia o lo rechazaremos)
3. **Locale/TZ explícitos**: pasarlos en cada request (o aceptar defaults).
4. **Backfill de `gymPublicId`**: actualizar cron tasks para pasar `gymPublicId` en cada llamada (para que el Go popule la columna).
5. **Post-cutover**: limpiar feature flags y código de soporte dual del backend.

**Estos cambios viven en PRs separados del backend**, deben pasar los auditores que pide `backend/CLAUDE.md` (`clean-code-auditor` y `cybersecurity-auditor`).

---

## Follow-ups deferidos (post-cutover)

- [ ] **Fix 47h → 48h**: commit separado en el Go, sin mezclar con el port.
- [ ] **`ALTER COLUMN gymPublicId SET NOT NULL`** post-archivado del TS.
- [ ] **Decidir backfill de `gymPublicId`** para rows históricos (o aceptar NULLs permanentes).
- [ ] **Eliminar columnas legacy** del schema que el TS escribía y el Go no usa (si las hay — verificar al portar).
- [ ] **Regenerar el Postman collection** (hoy está obsoleto y miente sobre rutas que no existen).
- [ ] **Borrar `mail_service/CLAUDE.md`** o reemplazarlo por un puntero al `mail/CLAUDE.md`.
- [ ] **Renombrar el módulo Go** si decides un org de GitHub.

---

## Referencias

- **Contratos actuales** (oráculo del comportamiento TS): `mail_service/docs/contracts/<endpoint>/`
- **Hotfix tenant-leakage aplicado**: `mail_service/internal/service/tenant.ts` (filtro `startsWith: cron_${gymName}`)
- **Backend que llama al servicio**: `backend/src/services/cron/cronTasks.ts` (y otros — buscar `MAIL_API_URL`)
- **`mail_service/CLAUDE.md`**: desactualizado, no usar como fuente.
- **`mail_service/docs/Powercave_Mail_Service.postman_collection.json`**: desactualizado, no usar como fuente.

---

## Addendum bootstrap (2026-05-17)

Cambios consolidados durante el bootstrap del repo Go que difieren de o refinan las decisiones originales:

- **Decisión #6 (validator library) reemplazada**: se descartó `go-playground/validator`. Cada DTO escribe su propio `Validate() []domain.Error`. Razón: menos reflexión, control explícito del `code` por campo, una dependencia menos. Si aparece duplicación real entre DTOs en Fase 1+, se levanta un paquete `internal/validation` ahí — no antes.
- **Decisión #11 (versión Go) actualizada**: el repo corre `go 1.26` (toolchain instalado al momento del bootstrap), no `1.25`. Sin impacto en el plan.
- **Migraciones unificadas**: las dos migraciones planificadas (0001 fresh + 0002 extend) se colapsaron en un único `0001_init` idempotente que cubre ambos escenarios (DB fresca y DB compartida con Prisma del TS) usando `DO $$ EXCEPTION WHEN duplicate_object` para `CREATE TYPE`, `ADD VALUE IF NOT EXISTS` para enum extensions, `ADD COLUMN IF NOT EXISTS` para columnas aditivas e `IF NOT EXISTS` para tabla e índices.
- **Body shape + auth hardening del bootstrap**: `RequireJWT` pin estricto a HS256 (no familia HMAC), middleware global `RequestTimeout` que propaga el deadline a `r.Context()`, middleware global `MaxBody` con `http.MaxBytesReader` (default 1 MiB, env `HTTP_MAX_BODY_BYTES`), CORS estricto allowlist sin wildcard. Pool de pgx config-driven (`DB_MAX_CONNS`, etc.).
