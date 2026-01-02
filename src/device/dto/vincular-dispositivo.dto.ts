import { IsString, IsOptional, IsInt, Min, Max, Matches, IsDateString } from 'class-validator';

export class VincularDispositivoDto {
  @IsString()
  // Acepta MAC address (formato AA:BB:CC:DD:EE:FF) o UUID de BLE (Android/iOS)
  mac_address: string;

  @IsInt()
  @Min(0)
  @Max(100)
  bateria: number;

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
  ble_device_id?: string; // ID del dispositivo BLE para referencia
}
