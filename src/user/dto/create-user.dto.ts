import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from '../../auth/normalize-email';

export class CreateUserDto {
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(120)
	nombre!: string;

	@Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
	@IsEmail()
	@MaxLength(254)
	email!: string;

	@IsString()
	@MinLength(6)
	@MaxLength(72)
	contrasena!: string;
}
