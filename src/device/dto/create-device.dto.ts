import { IsInt, IsOptional, IsString, Matches, Min, Max } from 'class-validator';

export class CreateDeviceDto {
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	bateria?: number;

	@IsOptional()
	@IsString()
	@Matches(/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i, { message: 'mac_address inválida' })
	mac_address?: string;
}
