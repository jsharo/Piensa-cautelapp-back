import { IsString, IsOptional, IsDateString, IsNumber, IsIn } from 'class-validator';

// Alineado al modelo Prisma `Notificaciones`
export class CreateNotificationDto {
  @IsNumber()
  id_adulto: number;

  @IsString()
  @IsIn(['EMERGENCIA', 'AYUDA'])
  tipo: 'EMERGENCIA' | 'AYUDA';

  @IsOptional()
  @IsDateString()
  fecha_hora?: string;

  @IsOptional()
  @IsNumber()
  pulso?: number;

  @IsOptional()
  @IsString()
  mensaje?: string;
}
