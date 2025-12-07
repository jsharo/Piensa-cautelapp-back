import { IsInt, IsNumber, IsOptional, IsString, IsIn, IsDateString } from 'class-validator';

export class ESP32WebhookDto {
  @IsString()
  mac_address: string;

  @IsString()
  @IsIn(['EMERGENCIA', 'AYUDA'])
  tipo: 'EMERGENCIA' | 'AYUDA';

  // Campos legacy para compatibilidad (no obligatorios)
  @IsOptional()
  @IsString()
  tipo_alerta?: string; // 'automatica' | 'manual'

  @IsOptional()
  @IsString()
  mensaje?: string;

  // Campo legacy equivalente
  @IsOptional()
  @IsString()
  mensaje_adicional?: string;

  // Fecha y hora del evento (opcional, el backend rellenará si no se envía)
  @IsOptional()
  @IsDateString()
  fecha_hora?: string;

  @IsOptional()
  @IsInt()
  bateria?: number;

  @IsOptional()
  @IsString()
  ubicacion?: string;
}
