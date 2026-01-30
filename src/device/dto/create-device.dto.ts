import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDeviceDto {
	@IsNotEmpty()
	@IsString()
	id_dispositivo: string; // ID del dispositivo del ESP32 (ej: "CA-001", "CA-002")
}
