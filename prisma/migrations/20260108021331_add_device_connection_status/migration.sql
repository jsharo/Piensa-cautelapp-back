/*
  Warnings:

  - A unique constraint covering the columns `[device_id]` on the table `Dispositivo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `Dispositivo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Dispositivo" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "device_id" TEXT,
ADD COLUMN     "last_seen" TIMESTAMP(3),
ADD COLUMN     "online_status" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_device_id_key" ON "Dispositivo"("device_id");
