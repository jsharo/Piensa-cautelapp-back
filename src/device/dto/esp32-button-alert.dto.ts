import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

/**
 * DTO para recibir alertas del botón de pánico
 * El ESP32 envía estos datos cuando el usuario presiona el botón de emergencia
 */
export class Esp32ButtonAlertDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string; // ID del dispositivo (ej: "CA-1")

  @IsOptional()
  @IsString()
  userId?: string; // ID del usuario (si está disponible)

  @IsNotEmpty()
  @IsString()
  sensor_type: string; // Siempre "BUTTON"

  @IsNotEmpty()
  @IsString()
  alert_type: string; // Tipo de alerta: "BOTON_PANICO"

  @IsNotEmpty()
  @IsNumber()
  bpm: number; // Pulso cardíaco al momento de la alerta

  @IsNotEmpty()
  @IsString()
  message: string; // Mensaje de la alerta

  @IsNotEmpty()
  @IsString()
  timestamp: string; // Timestamp ISO 8601
}
