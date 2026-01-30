/*
  Warnings:

  - The primary key for the `Dispositivo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `bateria` on the `Dispositivo` table. All the data in the column will be lost.
  - You are about to drop the column `device_id` on the `Dispositivo` table. All the data in the column will be lost.
  - You are about to drop the column `mac_address` on the `Dispositivo` table. All the data in the column will be lost.

*/

-- PASO 1: Crear columna temporal para almacenar el nuevo id_dispositivo (device_id)
ALTER TABLE "Dispositivo" ADD COLUMN "new_id_dispositivo" TEXT;

-- PASO 2: Migrar datos: Copiar device_id (o mac_address si device_id es null) a new_id_dispositivo
UPDATE "Dispositivo" 
SET "new_id_dispositivo" = COALESCE("device_id", "mac_address", 'CA-' || "id_dispositivo"::TEXT);

-- PASO 3: Crear columna temporal en AdultoMayor para nuevos IDs
ALTER TABLE "AdultoMayor" ADD COLUMN "new_id_dispositivo" TEXT;

-- PASO 4: Migrar las FKs: actualizar la columna temporal con los nuevos valores
UPDATE "AdultoMayor" am
SET "new_id_dispositivo" = (
  SELECT d."new_id_dispositivo"
  FROM "Dispositivo" d
  WHERE d."id_dispositivo" = am."id_dispositivo"
)
WHERE am."id_dispositivo" IS NOT NULL;

-- PASO 5: Drop FK constraint
ALTER TABLE "AdultoMayor" DROP CONSTRAINT "AdultoMayor_id_dispositivo_fkey";

-- PASO 6: Drop columna vieja de AdultoMayor
ALTER TABLE "AdultoMayor" DROP COLUMN "id_dispositivo";

-- PASO 7: Renombrar new_id_dispositivo a id_dispositivo en AdultoMayor
ALTER TABLE "AdultoMayor" RENAME COLUMN "new_id_dispositivo" TO "id_dispositivo";

-- PASO 8: Drop indices
DROP INDEX IF EXISTS "Dispositivo_device_id_key";
DROP INDEX IF EXISTS "Dispositivo_mac_address_key";

-- PASO 9: Drop PK constraint
ALTER TABLE "Dispositivo" DROP CONSTRAINT "Dispositivo_pkey";

-- PASO 10: Eliminar el default de id_dispositivo antes de drop el sequence
ALTER TABLE "Dispositivo" ALTER COLUMN "id_dispositivo" DROP DEFAULT;

-- PASO 11: Drop sequence
DROP SEQUENCE IF EXISTS "Dispositivo_id_dispositivo_seq";

-- PASO 12: Drop columnas viejas de Dispositivo
ALTER TABLE "Dispositivo" 
DROP COLUMN "bateria",
DROP COLUMN "device_id",
DROP COLUMN "mac_address",
DROP COLUMN "id_dispositivo";

-- PASO 11: Renombrar new_id_dispositivo a id_dispositivo en Dispositivo
ALTER TABLE "Dispositivo" RENAME COLUMN "new_id_dispositivo" TO "id_dispositivo";

-- PASO 12: Hacer id_dispositivo NOT NULL
ALTER TABLE "Dispositivo" ALTER COLUMN "id_dispositivo" SET NOT NULL;

-- PASO 13: Agregar PK constraint
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id_dispositivo");

-- PASO 14: Recrear FK constraint
ALTER TABLE "AdultoMayor" ADD CONSTRAINT "AdultoMayor_id_dispositivo_fkey" FOREIGN KEY ("id_dispositivo") REFERENCES "Dispositivo"("id_dispositivo") ON DELETE SET NULL ON UPDATE CASCADE;
