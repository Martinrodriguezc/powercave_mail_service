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
| GET | `/mail/last-emails-by-tenant` | JWT | Recent emails grouped by tenant |

## Email Templates

HTML templates live in `internal/html/` and are loaded once at startup via `fs.readFileSync` in `internal/domain/templates.ts`. Templates use string replacement (not a templating engine) — placeholders like `{{userName}}` are replaced in service functions.

Each gym can attach its logo as an inline CID attachment (`internal/domain/logo.ts`).

## Key Patterns

- **Bulk sends** use sequential processing with 1-2s delays between emails (rate limiting for Resend)
- **Reminder deduplication**: the reminder service checks `EmailLog` to skip recipients who received a reminder in the last 48 hours
- **Email logging**: sent emails are recorded in the `mail_logs` table (`EmailLog` model) with status tracking (pending/sent/failed)
- **Comments and docs are in Spanish** — this is the project convention

## Environment Variables

See `.env.example`. Key vars:
- `DATABASE_URL` — PostgreSQL connection for email logs
- `RESEND_API_KEY` — Resend email provider API key
- `SENDER_EMAIL` — From address for all emails
- `MAIL_SERVICE_API_KEY` — Shared secret for backend-to-service auth
- `JWT_SECRET` — Must match the backend's JWT secret (for tenant endpoint)
- `ALLOWED_ORIGINS` — Comma-separated CORS origins
