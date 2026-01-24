-- AlterTable
ALTER TABLE "SensorData" ADD COLUMN     "alert_type" TEXT,
ADD COLUMN     "is_alert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sensor_type" TEXT;
