-- IF NOT EXISTS a proposito: la base traia parte de estos valores aplicados
-- a mano desde docs/MIGRATION_DECISIONS.md, fuera del historial de Prisma.
-- Sin el guard la migracion revienta en cualquier entorno con ese drift.

-- AlterEnum
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'campaign_email';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'daily_admin_report';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'daily_sales_report';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'password_reset';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'client_password_reset';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'platform_user_credentials';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'client_app_invitation';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'manager_welcome';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'staff_welcome';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'payment_link';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'low_stock_alert';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'sales_order_to_factory';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'trainer_email_verification';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'trainer_account_exists';
ALTER TYPE "MailType" ADD VALUE IF NOT EXISTS 'trainer_invitation';

-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'blocked';
