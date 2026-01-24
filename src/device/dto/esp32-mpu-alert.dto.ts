import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

/**
 * DTO para recibir alertas del sensor MPU6050 (solo cuando detecta desmayo)
 * El ESP32 envía estos datos solo cuando confirma un desmayo
 */
export class Esp32MpuAlertDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string; // ID del dispositivo (ej: "CautelApp-D1")

  @IsOptional()
  @IsString()
  userId?: string; // ID del usuario (si está disponible)

  @IsNotEmpty()
  @IsString()
  sensor_type: string; // Siempre "MPU6050"

  @IsNotEmpty()
  @IsString()
  alert_type: string; // Tipo de alerta: "DESMAYO_CONFIRMADO"

  // ===== Datos del sensor MPU6050 =====
  @IsNotEmpty()
  @IsNumber()
  mpu_acceleration: number; // Aceleración total en g

  @IsNotEmpty()
  @IsString()
  mpu_status: string; // Estado: "DESMAYO_DETECTADO"

  @IsNotEmpty()
  @IsBoolean()
  mpu_fall_detected: boolean; // Siempre true en alertas

  @IsNotEmpty()
  @IsBoolean()
  mpu_stable: boolean; // Estado de estabilidad

  // ===== Información General =====
  @IsNotEmpty()
  @IsNumber()
  battery: number; // Nivel de batería (0-100)

  @IsNotEmpty()
  @IsString()
  wifi_ssid: string; // SSID de la red WiFi

  @IsNotEmpty()
  @IsNumber()
  wifi_rssi: number; // Intensidad de la señal WiFi

  @IsNotEmpty()
  @IsString()
  timestamp: string; // Timestamp ISO 8601

  @IsNotEmpty()
  @IsBoolean()
  is_alert: boolean; // Siempre true para MPU alerts
}
