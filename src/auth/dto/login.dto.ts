import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  contrasena: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
