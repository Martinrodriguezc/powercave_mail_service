---
name: Mail Service Patterns and Anti-Patterns
description: Recurring patterns and anti-patterns found in powercave_mail_service during audits (domain, config, utils, entry point, controllers, middleware)
type: project
---

Established patterns in this service:
- Two auth strategies: `requireApiKey` (service-to-service) and `requireAuth` + `requireMailServiceAccess` (JWT for frontend)
- `createServiceLogger(serviceName)` from `utils/logger.ts` — all controllers/services create a named logger instance
- Bulk sends use sequential processing with 1-2 second delays (intentional Resend rate limiting)
- `error: error?.message` is consistently exposed in 500 responses — intentional for internal tooling context
- `/send_discount_email` intentionally has NO auth middleware — confirmed by CLAUDE.md table listing auth as "None"
- `validateBody` in `middleware.ts/mail.ts` is defined but never used in any route (dead code, confirmed across audits)
- `config.ts` uses empty-string fallback (`|| ''`) for required secrets — no startup validation, confirmed anti-pattern
- `AuthenticatedRequest.user` is typed as `any` — downstream middleware re-casts it
- `internal/middleware.ts` is a directory despite having a `.ts` suffix — Go-inspired layout quirk, intentional
- `cmd/main.ts` reads PORT from both `config` object AND directly from `process.env.PORT` (line 9) — duplication; config object also stores PORT but main.ts ignores it
- CORS allows all origins when `allowedOrigins` list is empty (config fallback) — an intentional but risky open fallback
- `AppConfig` interface in config.ts contains two overlapping fields: `ALLOWED_ORIGIN` (singular, legacy) and `ALLOWED_ORIGINS` (plural, current) — main.ts handles both via OR, but only `ALLOWED_ORIGINS` is in .env.example
- HTML template injection is done via `.replace()` — no escaping, potential XSS in outbound email content if user-controlled values reach templates
- `getLogoImgHtml` is the single source of truth for the CID img tag; `getLogoCid` handles slug sanitization and length-cap at 128 chars
- `ReminderMail` re-declares `gymName` and `logoUrl` as optional fields that are already declared on the parent `Mail` interface — redundant declarations
- `LogContext` interface uses `[key: string]: unknown` index signature alongside `email?: string` — this is a PII-logging risk pattern, no scrubbing layer
- `hasRecentReminderSent` uses a -47h threshold but the deduplication window is described as 48h in comments and CLAUDE.md — off-by-one-hour discrepancy
- `package.json` includes `mailersend` and `nodemailer` as runtime dependencies, but the service only uses `resend` — dead dependencies
- `sendMail` catches errors and re-throws after logging, meaning callers always see the throw; this is the correct propagation pattern

Services layer additional patterns (third audit — services layer deep dive):
- Template replacement is INCONSISTENT across services: section-level tokens (`{{planSalesSection}}`, `{{EXPIRING_SECTION}}`) use single-call `replace('{{token}}', ...)` while value tokens (`{{gymName}}`, `{{logoImg}}`) use `/regex/g`. Any template token that appears more than once and uses the non-regex form will silently leave unreplaced tokens in the rendered HTML.
- `getLastEmailByTenant` in `tenant.ts` is a textbook N+1: `groupBy` returns N tenant groups, then fires N sequential `findFirst` queries. Should be replaced with a single `findMany` ordered by `sentAt desc` and grouped in application code, or a raw `DISTINCT ON` query.
- `sendBulkReminderMails` stores `error.stack` (full stack trace) in `ReminderReportResult.error`, which is then injected verbatim into the HTML admin report email via `generateReminderReportHTML`. Stack traces in outbound emails are an operational hygiene issue and may expose internal path info.
- `admin_service.ts` line 22 passes `sentBy` as `userName` in the `sendMail` call — `userName` is a display-name field on `Mail` intended for recipient greeting. Passing an internal actor ID here is semantically wrong.
- `renderPlanSalesSection`, `renderFoodSalesSection`, `renderMerchandiseSalesSection` in `sales/helpers.ts` are structurally identical — same table markup, same footer, same `renderSaleRow` call — differing only in which sale property they extract (`planName`/`foodName`/`productName`). Pure DRY violation.
- `catch (error: any)` is used in every catch block across the service layer. TypeScript 4+ catch variables are `unknown` by default; using `any` bypasses type safety entirely.
- `createServiceLogger('mail-service')` is instantiated independently in both `mail.ts` and `reminders.ts` — these share the same service name string, which is fine functionally but could cause confusion; at minimum the string literal should be a shared constant.
- `sendDiscountEmail` does not pass `logoUrl` / `gymName` to `sendMail` (they are absent from `DiscountMail` opts that reach `sendMail`) — consistent with the discount template not rendering a logo, but worth documenting as intentional.

**Why:** Accumulated across three full audit passes covering the entire service.
**How to apply:** Use these observations to skip re-discovery in future sessions and focus on deltas.
