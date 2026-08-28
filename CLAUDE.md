# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

PowerCave Mail Service — a standalone Express microservice that sends transactional emails for the PowerCave gym management platform. It uses **Resend** as the email provider and **Prisma + PostgreSQL** for logging sent emails.

This service is called by the PowerCave backend via REST API (authenticated with `X-API-Key` header). It runs on port 3000 by default.

## Commands

```bash
npm run dev          # Run with ts-node (no build step)
npm run build        # TypeScript compile to dist/
npm run prisma:migrate  # Create/apply migrations (dev)
npm run migrate:deploy  # Apply migrations (production)
npm run prisma:studio   # Open Prisma Studio DB browser
```

There are no tests or linting configured in this project.

## Architecture

Go-inspired layout with `cmd/`, `internal/`, `config/`, `utils/`:

- **`cmd/main.ts`** — Express app entry point, CORS setup, mounts all routes under `/mail`
- **`internal/controllers/`** — Route handlers (one file per email domain). Each registers routes on a sub-router, all merged in `index.ts`
- **`internal/service/`** — Business logic. `mail.ts` is the core Resend send function; other files compose HTML and call it
- **`internal/domain/`** — TypeScript interfaces (`Mail`, `ReminderMail`, `DiscountMail`, etc.), HTML template loading, logo handling
- **`internal/html/`** — HTML email templates with placeholder tokens replaced at send time
- **`internal/middleware.ts/`** — Auth middleware (this is a directory despite the `.ts` suffix)
- **`config/config.ts`** — Central env var config object
- **`utils/logger.ts`** — Pino-based structured logger
- **`prisma/schema.prisma`** — `EmailLog` model for tracking sent emails
- **`internal/service/mailLog.ts`** — contexto de gimnasio, tope diario y escritura del registro

## API Endpoints

All routes are prefixed with `/mail`. Two auth strategies:

| Auth | Middleware | Used by |
|------|-----------|---------|
| API Key (`X-API-Key` header) | `requireApiKey` | Backend service-to-service calls |
| JWT (`Authorization: Bearer`) | `requireAuth` + `requireMailServiceAccess` | Frontend direct calls (MANAGER/SUPERADMIN only) |

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/mail/send_reminder` | API Key | Bulk plan expiry reminders + admin report |
| POST | `/mail/send_discount_email` | None | Single or bulk discount/promo emails |
| POST | `/mail/send_daily_admin_report` | API Key | Daily admin renewal summary |
| POST | `/mail/send_daily_sales_report` | API Key | Daily sales summary |
| POST | `/mail/send_password_reset` | API Key | Password reset link email |
| POST | `/mail/send_platform_user_credentials` | API Key | New user credentials email |
| POST | `/mail/send_trainer_email_verification` | API Key | Trainer email verification link (24h) |
| POST | `/mail/send_trainer_account_exists` | API Key | Notice that the email already has an account |
| POST | `/mail/send_trainer_invitation` | API Key | A gym invited the trainer to join |
| GET | `/mail/last-emails-by-tenant` | JWT | Recent emails grouped by tenant |
| GET | `/mail/usage` | JWT (SUPERADMIN) | Consumo de correos: hoy, mes, por gimnasio y por tipo (`?month=YYYY-MM`) |
| GET | `/mail/test/types` | JWT (SUPERADMIN) | Lista los tipos de correo testeables |
| POST | `/mail/test/send` | JWT (SUPERADMIN) | Envía una plantilla de prueba (`{ type, to?, withTestData, gymName?, logoUrl? }`) |

## Email Templates

HTML templates live in `internal/html/` and are loaded once at startup via `fs.readFileSync` in `internal/domain/templates.ts`. Templates use string replacement (not a templating engine) — placeholders like `{{userName}}` are replaced in service functions.

Each gym can attach its logo as an inline CID attachment (`internal/domain/logo.ts`).

El logo de DashCore vive en `assets/`. El sufijo del archivo nombra el **fondo**, igual que en el frontend: `dashcore-logo.png` va sobre fondo oscuro (las 12 plantillas dark) y `dashcore-logo-light.png` sobre fondo claro (la nota de venta B2B). Se adjunta como CID desde `sendMail` solo si el HTML referencia `cid:dashcore_logo"` o `cid:dashcore_logo_light"` — la comilla de cierre importa, sin ella el primer CID matchea al segundo. El pie de todas las plantillas dice "© {{year}} DashCore", no el nombre del gimnasio. El naranjo de marca es `#f5b305` y los títulos usan `'Gemunu Libre'` con fallback a `'Segoe UI'`. **La webfont solo carga en Apple Mail / iOS Mail / Samsung Mail / Outlook Mac**: Gmail y Outlook eliminan el `<link>` externo y siempre ven el fallback. Es progressive enhancement asumido (decisión del usuario, ago-2026).

Por eso **los tamaños de tipografía se eligen para el fallback, no para Gemunu**. Gemunu es condensada y tienta a subir el `font-size` para compensar, pero eso rompe el render de la mayoría: el `<h1>` a 32px/`letter-spacing:3px` partía el nombre del gimnasio en dos líneas de 74px de alto en Gmail. A 28px/`ls:2px` entra en una línea para un nombre de largo típico. Para medirlo: `node scripts/preview.mjs <template> "<nombre del gym>"`.

Para ver una plantilla en el navegador sin enviarla: `node scripts/preview.mjs <template>` → `scripts/preview.html`.

## Key Patterns

- **Bulk sends** use sequential processing with 1-2s delays between emails (rate limiting for Resend)
- **Reminder deduplication**: the reminder service checks `EmailLog` to skip recipients who received a reminder in the last 48 hours
- **Email logging**: **todos** los envíos se registran en `mail_logs` (`EmailLog`) con una sola escritura y el estado final (`sent`/`failed`/`blocked`), atribuidos al gimnasio (`gymPublicId`, `gymName`, `localDay`). El registro y el chequeo de cupo viven en `internal/service/mailLog.ts` y se aplican en los 4 puntos que tocan Resend. Ver `docs/contracts/_common.md`
- **Comments and docs are in Spanish** — this is the project convention

## Environment Variables

See `.env.example`. Key vars:
- `DATABASE_URL` — PostgreSQL connection for email logs
- `RESEND_API_KEY` — Resend email provider API key
- `SENDER_EMAIL` — From address for all emails
- `MAIL_SERVICE_API_KEY` — Shared secret for backend-to-service auth
- `JWT_SECRET` — Must match the backend's JWT secret (for tenant endpoint)
- `ALLOWED_ORIGINS` — Comma-separated CORS origins
- `MAIL_DAILY_LIMIT_DEFAULT` — Tope diario de correos por gimnasio (default 1000)
