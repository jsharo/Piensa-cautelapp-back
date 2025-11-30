import { IsEmail, IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateUserDto {
	@IsString()
	@IsNotEmpty()
	nombre: string;

	@IsEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	contrasena: string;

	@IsOptional()
	@IsInt()
	id_rol?: number;
}
