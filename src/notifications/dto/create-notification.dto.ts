import { IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';

// Alineado al modelo Prisma `Notificaciones`
export class CreateNotificationDto {
  @IsNumber()
  id_adulto: number;

  @IsString()
  tipo: string;

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
