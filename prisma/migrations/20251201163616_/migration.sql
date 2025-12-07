/*
  Warnings:

  - A unique constraint covering the columns `[mac_address]` on the table `Dispositivo` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Dispositivo" ADD COLUMN     "mac_address" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_mac_address_key" ON "Dispositivo"("mac_address");
