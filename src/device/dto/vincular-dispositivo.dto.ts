import { IsString, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';

export class VincularDispositivoDto {
  @IsNotEmpty()
  @IsString()
  id_dispositivo: string; // ID del dispositivo del ESP32 (ej: "CA-001", "CA-002")

  @IsOptional()
  @IsString()
  nombre_adulto?: string;

  @IsOptional()
  @IsDateString()
  fecha_nacimiento?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  ble_device_id?: string; // ID del dispositivo BLE para referencia (opcional)
}
