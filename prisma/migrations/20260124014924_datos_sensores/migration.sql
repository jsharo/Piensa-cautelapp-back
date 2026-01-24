-- CreateTable
CREATE TABLE "SensorData" (
    "id_sensor" SERIAL NOT NULL,
    "id_dispositivo" INTEGER NOT NULL,
    "mpu_acceleration" DOUBLE PRECISION,
    "mpu_fall_detected" BOOLEAN,
    "mpu_stable" BOOLEAN,
    "mpu_status" TEXT,
    "max_ir_value" DOUBLE PRECISION,
    "max_bpm" DOUBLE PRECISION,
    "max_avg_bpm" DOUBLE PRECISION,
    "max_connected" BOOLEAN,
    "battery" INTEGER,
    "wifi_ssid" TEXT,
    "wifi_rssi" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorData_pkey" PRIMARY KEY ("id_sensor")
);

-- CreateIndex
CREATE INDEX "SensorData_id_dispositivo_idx" ON "SensorData"("id_dispositivo");

-- CreateIndex
CREATE INDEX "SensorData_timestamp_idx" ON "SensorData"("timestamp");

-- AddForeignKey
ALTER TABLE "SensorData" ADD CONSTRAINT "SensorData_id_dispositivo_fkey" FOREIGN KEY ("id_dispositivo") REFERENCES "Dispositivo"("id_dispositivo") ON DELETE CASCADE ON UPDATE CASCADE;
