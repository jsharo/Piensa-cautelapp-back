import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateAdultoMayorDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsDateString()
  fecha_nacimiento?: string;

  @IsOptional()
  @IsString()
  direccion?: string;
}
