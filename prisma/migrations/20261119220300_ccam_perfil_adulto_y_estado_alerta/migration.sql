-- AlterTable
ALTER TABLE "Usuario-AdultoMayor" DROP CONSTRAINT "Usuario-AdultoMayor_id_usuario_fkey";

-- AlterTable
ALTER TABLE "Usuario-AdultoMayor" DROP CONSTRAINT "Usuario-AdultoMayor_id_adulto_fkey";

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AdultoMayor" ADD COLUMN "antecedentes_medicos" TEXT,
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "notas_psicologicas" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Notificaciones" ADD COLUMN "atendida_at" TIMESTAMP(3),
ADD COLUMN "atendido_by_id" INTEGER,
ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "nota_atencion" TEXT,
ADD COLUMN "spo2" INTEGER,
ALTER COLUMN "fecha_hora" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "AdultoMayor_id_dispositivo_key" ON "AdultoMayor"("id_dispositivo");

-- AddForeignKey
ALTER TABLE "Notificaciones" ADD CONSTRAINT "Notificaciones_atendido_by_id_fkey" FOREIGN KEY ("atendido_by_id") REFERENCES "Usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario-AdultoMayor" ADD CONSTRAINT "Usuario-AdultoMayor_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario-AdultoMayor" ADD CONSTRAINT "Usuario-AdultoMayor_id_adulto_fkey" FOREIGN KEY ("id_adulto") REFERENCES "AdultoMayor"("id_adulto") ON DELETE CASCADE ON UPDATE CASCADE;
