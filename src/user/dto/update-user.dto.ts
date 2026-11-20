import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from '../../auth/normalize-email';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
	@IsOptional()
	@IsString()
	@MaxLength(120)
	nombre?: string;

	@Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	email?: string;

	@Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	email_recuperacion?: string;

	@IsOptional()
	@IsString()
	@MinLength(6)
	@MaxLength(72)
	contrasena?: string;

	@IsOptional()
	@IsString()
	@MinLength(6)
	@MaxLength(72)
	contrasena_actual?: string;

	@IsOptional()
	@IsString()
	imagen?: string;
}
