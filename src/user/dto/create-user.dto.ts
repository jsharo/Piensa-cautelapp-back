import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
	@IsString()
	@IsNotEmpty()
	nombre: string;

	@IsEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	contrasena: string;
}
