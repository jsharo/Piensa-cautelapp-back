import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from '../normalize-email';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  contrasena!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dispositivo?: string;
}
