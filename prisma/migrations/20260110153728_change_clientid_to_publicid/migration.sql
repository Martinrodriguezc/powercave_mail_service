-- Migración segura: cambiar clientId (INTEGER) a publicId (TEXT)
-- Preserva los datos existentes convirtiendo los valores de clientId a publicId como strings

-- Paso 1: Agregar la nueva columna publicId como nullable temporalmente
ALTER TABLE "mail_logs" ADD COLUMN "publicId" TEXT;

-- Paso 2: Copiar y convertir los datos existentes de clientId a publicId
-- Convertimos los valores INTEGER a TEXT
UPDATE "mail_logs" SET "publicId" = CAST("clientId" AS TEXT) WHERE "publicId" IS NULL;

-- Paso 3: Hacer publicId NOT NULL ahora que tiene datos
ALTER TABLE "mail_logs" ALTER COLUMN "publicId" SET NOT NULL;

-- Paso 4: Eliminar la columna antigua clientId
ALTER TABLE "mail_logs" DROP COLUMN "clientId";



