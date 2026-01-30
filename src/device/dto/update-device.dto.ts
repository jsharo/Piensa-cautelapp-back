import { PartialType } from '@nestjs/mapped-types';
import { CreateDeviceDto } from './create-device.dto';

// UpdateDeviceDto hereda de CreateDeviceDto pero hace los campos opcionales
export class UpdateDeviceDto extends PartialType(CreateDeviceDto) {}
