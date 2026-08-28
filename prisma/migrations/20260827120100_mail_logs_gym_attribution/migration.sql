-- AlterTable: columnas de atribucion al gimnasio y del proveedor
-- IF NOT EXISTS a proposito: `gymPublicId` y `providerMessageId` ya estaban
-- aplicados a mano en algunos entornos, fuera del historial de Prisma.
ALTER TABLE "mail_logs"
  ADD COLUMN IF NOT EXISTS "gymPublicId"       TEXT,
  ADD COLUMN IF NOT EXISTS "gymName"           TEXT,
  ADD COLUMN IF NOT EXISTS "dailyLimit"        INTEGER,
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "localDay"          VARCHAR(10);

-- `localDay` es texto ISO YYYY-MM-DD a proposito, no DATE: comparar una columna
-- DATE contra un Date de JS depende de la zona de sesion de Postgres y un
-- off-by-one ahi corre el corte del dia sin que se note. Como texto ISO el
-- orden lexicografico coincide con el cronologico, asi que los rangos y el
-- indice siguen funcionando.
--
-- Backfill: las filas historicas no tienen timezone de gimnasio, se usa el de la
-- plataforma. `sentAt` es TIMESTAMP sin zona y Prisma lo guarda en UTC, asi que
-- primero hay que marcarlo como UTC y recien despues convertirlo a Santiago. Un
-- solo AT TIME ZONE lo interpretaria como hora local y correria la fecha.
UPDATE "mail_logs"
SET "localDay" = to_char(
  ("sentAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago',
  'YYYY-MM-DD'
)
WHERE "localDay" IS NULL;

ALTER TABLE "mail_logs" ALTER COLUMN "localDay" SET NOT NULL;

-- Los correos sin cliente (reportes, alertas de stock, credenciales) no tienen estos datos.
ALTER TABLE "mail_logs" ALTER COLUMN "publicId" DROP NOT NULL;
ALTER TABLE "mail_logs" ALTER COLUMN "clientName" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mail_logs_gymPublicId_localDay_idx" ON "mail_logs" ("gymPublicId", "localDay");
CREATE INDEX IF NOT EXISTS "mail_logs_localDay_idx" ON "mail_logs" ("localDay");
