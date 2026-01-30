import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

/**
 * DTO para recibir datos del sensor MAX30102 (cada 5 segundos)
 * El ESP32 envía estos datos periódicamente para monitoreo de ritmo cardíaco
 */
export class Esp32MaxDataDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string; // ID del dispositivo (ej: "CautelApp-D1")

  @IsOptional()
  @IsString()
  userId?: string; // ID del usuario (si está disponible)

  @IsNotEmpty()
  @IsString()
  sensor_type: string; // Siempre "MAX30102"

  // ===== Datos del sensor MAX30102 =====
  @IsNotEmpty()
  @IsNumber()
  max_ir_value: number; // Valor IR del sensor

  @IsNotEmpty()
  @IsNumber()
  max_bpm: number; // Pulsaciones por minuto actuales

  @IsNotEmpty()
  @IsNumber()
  max_avg_bpm: number; // Promedio de BPM

  @IsNotEmpty()
  @IsBoolean()
  max_connected: boolean; // ¿El sensor está conectado?

  // NO se requieren battery, wifi_rssi, timestamp, is_alert
  // Estos datos se eliminaron para transmisión en tiempo real sin almacenamiento

  @IsOptional()
  @IsBoolean()
  is_alert: boolean; // Siempre false para MAX (no son alertas)
}
