import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

/**
 * DTO para recibir datos de sensores del ESP32
 * Los datos incluyen:
 * - MPU6050: Detección de caídas (aceleración total, estado de estabilidad)
 * - MAX30102: Monitor de ritmo cardíaco (BPM, promedio BPM)
 */
export class Esp32SensorDataDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string; // ID del dispositivo (ej: "CautelApp-D1")

  @IsOptional()
  @IsString()
  userId?: string; // ID del usuario (si está disponible)

  // ===== Datos del sensor MPU6050 =====
  @IsOptional()
  @IsNumber()
  mpu_acceleration?: number; // Aceleración total en g

  @IsOptional()
  @IsBoolean()
  mpu_fall_detected?: boolean; // ¿Se detectó una caída?

  @IsOptional()
  @IsBoolean()
  mpu_stable?: boolean; // ¿El dispositivo está estable?

  @IsOptional()
  @IsString()
  mpu_status?: string; // Estado del MPU ("FAINTING", "NORMAL", etc.)

  // ===== Datos del sensor MAX30102 =====
  @IsOptional()
  @IsNumber()
  max_ir_value?: number; // Valor IR del sensor

  @IsOptional()
  @IsNumber()
  max_bpm?: number; // Pulsaciones por minuto actuales

  @IsOptional()
  @IsNumber()
  max_avg_bpm?: number; // Promedio de BPM

  @IsOptional()
  @IsBoolean()
  max_connected?: boolean; // ¿El sensor está conectado?

  // ===== Información General =====
  @IsOptional()
  @IsNumber()
  battery?: number; // Nivel de batería (0-100)

  @IsOptional()
  @IsString()
  wifi_ssid?: string; // SSID de la red WiFi conectada

  @IsOptional()
  @IsNumber()
  wifi_rssi?: number; // Intensidad de la señal WiFi

  @IsOptional()
  @IsString()
  timestamp?: string; // Timestamp de cuando se enviaron los datos (ISO 8601)
}
