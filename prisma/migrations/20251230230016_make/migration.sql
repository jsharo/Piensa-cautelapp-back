-- DropForeignKey
ALTER TABLE "AdultoMayor" DROP CONSTRAINT "AdultoMayor_id_dispositivo_fkey";

-- AlterTable
ALTER TABLE "AdultoMayor" ALTER COLUMN "id_dispositivo" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AdultoMayor" ADD CONSTRAINT "AdultoMayor_id_dispositivo_fkey" FOREIGN KEY ("id_dispositivo") REFERENCES "Dispositivo"("id_dispositivo") ON DELETE SET NULL ON UPDATE CASCADE;
