import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

/**
 * DTO para recibir alertas del sensor MPU6050 (solo cuando detecta desmayo)
 * El ESP32 envía estos datos solo cuando confirma un desmayo
 * Versión simplificada - solo campos esenciales
 */
export class Esp32MpuAlertDto {
  @IsNotEmpty()
  @IsString()
  deviceId!: string; // ID del dispositivo (ej: "CautelApp-D1")

  @IsOptional()
  @IsString()
  userId?: string; // ID del usuario (si está disponible)

  @IsNotEmpty()
  @IsString()
  sensor_type!: string; // Siempre "MPU6050"

  @IsNotEmpty()
  @IsString()
  alert_type!: string; // Tipo de alerta: "DESMAYO_CONFIRMADO"

  @IsNotEmpty()
  @IsNumber()
  bpm!: number; // Pulso cardíaco al momento de la alerta

  @IsNotEmpty()
  @IsString()
  timestamp!: string; // Timestamp ISO 8601
}
