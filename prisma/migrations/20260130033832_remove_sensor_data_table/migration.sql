/*
  Warnings:

  - You are about to drop the `SensorData` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SensorData" DROP CONSTRAINT "SensorData_id_dispositivo_fkey";

-- DropTable
DROP TABLE "SensorData";
